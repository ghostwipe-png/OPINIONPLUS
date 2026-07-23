// backend/src/routes/payments.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const payments = new Hono();

// Fallback package definitions — used only if the sms_packages table is
// unavailable (e.g. migration not yet applied). The database is always the
// source of truth when it can be queried.
const PACKAGES = [
  { id: 'sms_10', name: '10 SMS', amount: 1000, credits: 10 },
  { id: 'sms_50', name: '50 SMS', amount: 5000, credits: 50 },
  { id: 'sms_100', name: '100 SMS', amount: 10000, credits: 100 },
  { id: 'sms_500', name: '500 SMS', amount: 50000, credits: 500 },
  { id: 'sms_1000', name: '1000 SMS', amount: 100000, credits: 1000 },
];

const PRO_PLAN_AMOUNT = 40000; // KES 400 in cents
const REFERRAL_BONUS = 10000;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// In-memory best-effort rate limiter for the webhook endpoint.
//
// NOTE: Cloudflare Workers may run multiple isolates, so this in-memory map
// is a best-effort defense-in-depth layer only — it is NOT a substitute for
// the existing createRateLimiter (KV/Durable-Object backed) used elsewhere
// in the app. If `c.env.RATE_LIMIT_KV` or a shared `createRateLimiter` import
// is available in your deployment, prefer wiring that in here instead.
// ---------------------------------------------------------------------------
const __webhookHits = new Map(); // ip -> [timestamps]
const WEBHOOK_RATE_LIMIT = 30; // requests
const WEBHOOK_RATE_WINDOW_MS = 60 * 1000; // per minute

function checkWebhookRateLimit(ip) {
  const now = Date.now();
  const hits = (__webhookHits.get(ip) || []).filter((t) => now - t < WEBHOOK_RATE_WINDOW_MS);
  hits.push(now);
  __webhookHits.set(ip, hits);
  // opportunistic cleanup so the map doesn't grow unbounded
  if (__webhookHits.size > 5000) {
    for (const [key, arr] of __webhookHits) {
      if (!arr.some((t) => now - t < WEBHOOK_RATE_WINDOW_MS)) __webhookHits.delete(key);
    }
  }
  return hits.length <= WEBHOOK_RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function logEvent(kind, payload = {}) {
  try {
    console.log(JSON.stringify({ kind, timestamp: new Date().toISOString(), ...payload }));
  } catch (e) { /* never let logging break a request */ }
}

async function loggedFetch(kind, url, options, retries = MAX_RETRIES) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  try {
    const response = await fetchWithRetry(url, options, retries);
    logEvent('paystack_api_call', {
      request_id: requestId,
      label: kind,
      endpoint: url.replace(/https:\/\/api\.paystack\.co/, ''),
      status: response.status,
      duration_ms: Date.now() - start,
    });
    return response;
  } catch (e) {
    logEvent('paystack_api_call_error', {
      request_id: requestId,
      label: kind,
      endpoint: url.replace(/https:\/\/api\.paystack\.co/, ''),
      duration_ms: Date.now() - start,
      message: e.message,
    });
    throw e;
  }
}

// Constant-time hex string comparison (used for PIN + signature checks).
function constantTimeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Validates an admin PIN against the ADMIN_PIN_HASH secret using a
// constant-time comparison. Returns true/false — never throws.
async function verifyAdminPin(c, pin) {
  const expectedHash = c.env.ADMIN_PIN_HASH;
  if (!expectedHash || typeof pin !== 'string' || !pin) return false;
  try {
    const hex = await sha256Hex(pin);
    return constantTimeEqualHex(hex, expectedHash);
  } catch (e) {
    return false;
  }
}

// MAXIMUM SECURITY: Optimistic Locking to Prevent Double-Spend
async function finalizeTransaction(db, reference, expectedUserId, credits) {
  if (!expectedUserId || !credits || credits <= 0) return { credited: false };

  const update = await db
    .prepare('UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?')
    .bind('completed', reference, 'pending')
    .run();

  const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
  if (!flipped) return { credited: false };

  await db
    .prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
    .bind(expectedUserId, credits, credits)
    .run();
  return { credited: true };
}

async function activateProSubscription(db, userId) {
  await db
    .prepare(`INSERT INTO api_usage (user_id, tier, subscription_active) VALUES (?, 'pro', 1) ON CONFLICT(user_id) DO UPDATE SET tier = 'pro', subscription_active = 1`)
    .bind(userId)
    .run();
}

async function handlePartnerSubscription(db, userId, tier, referralCode) {
  if (!tier) return;
  await db.prepare('UPDATE users SET tier = ? WHERE id = ?').bind(tier, userId).run();
  await db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();

  if (referralCode) {
    const referrer = await db.prepare('SELECT * FROM users WHERE referral_code = ?').bind(referralCode).first();
    if (referrer && referrer.id !== userId) {
      const existing = await db.prepare('SELECT * FROM referrals WHERE referred_id = ?').bind(userId).first();
      if (!existing) {
        await db.batch([
          db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, bonus_paid) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), referrer.id, userId, REFERRAL_BONUS),
          db.prepare('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?').bind(REFERRAL_BONUS, REFERRAL_BONUS, referrer.id)
        ]);
      }
    }
  }
}

// SERVICE PROVISIONING HELPER (Supports admin grants & active statuses)
async function provisionServiceFromWebhook(db, order) {
  const { user_id, user_email, service_type, package_id } = order;

  if (service_type === 'sms') {
    const pkg = await db.prepare(`SELECT sms_count FROM sms_packages WHERE id = ?`).bind(package_id).first();
    const count = pkg ? pkg.sms_count : 100;
    await db.prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
      .bind(user_id, count, count).run();
    logEvent('webhook_service_provisioned', { service: 'sms', credits: count, user: user_email });
  } else if (service_type === 'press_release') {
    logEvent('webhook_service_provisioned', { service: 'press_release', package: package_id, user: user_email });
  } else if (service_type === 'sponsored') {
    const pkg = await db.prepare(`SELECT duration_days, impressions_goal FROM sponsored_packages WHERE id = ?`).bind(package_id).first();
    if (pkg) {
      await db.prepare('UPDATE service_orders SET metadata = json_insert(metadata, "$.duration_days", ?, "$.impressions_goal", ?) WHERE id = ?')
        .bind(pkg.duration_days, pkg.impressions_goal, order.id).run();
      logEvent('webhook_service_provisioned', { service: 'sponsored', days: pkg.duration_days, user: user_email });
    }
  } else if (service_type === 'api') {
    const tier = package_id || 'pro';
    const existingKey = await db.prepare('SELECT id FROM api_keys WHERE user_id = ?').bind(user_id).first();
    if (!existingKey) {
      const newKey = `op_${crypto.randomUUID().replace(/-/g, '')}`;
      await db.prepare('INSERT INTO api_keys (id, user_id, key, name, tier, requests_today) VALUES (?, ?, ?, ?, ?, 0)')
        .bind(crypto.randomUUID(), user_id, newKey, 'Default Production Key', tier).run();
    } else {
      await db.prepare('UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ?').bind(tier, user_id).run();
    }
    logEvent('webhook_service_provisioned', { service: 'api', package: tier, user: user_email });
  }
}

// MAXIMUM SECURITY: Constant-Time HMAC Signature Verification
async function verifyPaystackSignature(secretKey, rawBody, signatureHeader) {
  if (!signatureHeader || !secretKey) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const computedHex = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

    if (computedHex.length !== signatureHeader.length) return false;
    return constantTimeEqualHex(computedHex, signatureHeader);
  } catch (e) { return false; }
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPositiveInt(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function escapeHtml(str = '') {
  return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// Load SMS packages from the database (source of truth). Falls back to the
// hardcoded PACKAGES array if the table is missing or the query fails, so
// deployments that haven't run migrations yet keep working.
async function loadPackages(db) {
  try {
    const { results } = await db.prepare('SELECT * FROM sms_packages WHERE is_active = 1').all();
    if (results && results.length) {
      return results.map((row) => ({
        id: row.id,
        name: row.name || row.label || `${row.sms_count} SMS`,
        amount: row.price_kes_cents,
        credits: row.sms_count,
      }));
    }
  } catch (e) {
    logEvent('packages_db_lookup_failed', { message: e.message });
  }
  return PACKAGES;
}

async function findPackage(db, packageId) {
  const list = await loadPackages(db);
  return list.find((p) => p.id === packageId) || null;
}

function generateReceiptHtml(transaction) {
  const amountKes = (Number(transaction.amount || 0) / 100).toLocaleString('en-KE');
  const date = transaction.created_at ? new Date(transaction.created_at).toLocaleString('en-KE') : '';
  const status = escapeHtml(transaction.status || 'unknown');
  const reference = escapeHtml(transaction.reference || '');
  const method = escapeHtml(transaction.method || 'card / mobile money');
  const credits = escapeHtml(String(transaction.credits ?? '—'));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt · ${reference}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { --ink: #111111; --paper: #ffffff; --wire: #e2e2e2; --signal: #c0392b; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: var(--ink); background: #f6f6f4; margin: 0; padding: 40px 16px; }
  .receipt { max-width: 560px; margin: 0 auto; background: var(--paper); border: 1px solid var(--wire); padding: 40px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
  .tag { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #777; margin-bottom: 28px; }
  h1 { font-size: 18px; margin: 0 0 24px; border-bottom: 1px solid var(--wire); padding-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 0; border-bottom: 1px solid var(--wire); }
  td.label { color: #777; width: 45%; }
  td.value { text-align: right; font-weight: 600; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .status.completed { background: #eafaf0; color: #1e8449; }
  .status.pending { background: #fef6e0; color: #b9770e; }
  .status.failed, .status.refunded { background: #fdecea; color: var(--signal); }
  .thanks { margin-top: 28px; font-size: 14px; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--wire); font-size: 11px; color: #999; text-align: center; }
  @media print { body { background: var(--paper); padding: 0; } .receipt { border: none; } }
</style>
</head>
<body>
  <div class="receipt">
    <div class="brand">OPINIONPLUS</div>
    <div class="tag">Payment Receipt</div>
    <h1>Transaction ${reference}</h1>
    <table>
      <tr><td class="label">Date</td><td class="value">${date}</td></tr>
      <tr><td class="label">Amount</td><td class="value">KES ${amountKes}</td></tr>
      <tr><td class="label">Credits purchased</td><td class="value">${credits}</td></tr>
      <tr><td class="label">Payment method</td><td class="value">${method}</td></tr>
      <tr><td class="label">Reference</td><td class="value">${reference}</td></tr>
      <tr><td class="label">Status</td><td class="value"><span class="status ${status}">${status}</span></td></tr>
    </table>
    <p class="thanks">Thank you for your purchase. This receipt confirms your transaction with OPINIONPLUS.</p>
    <div class="footer">Need help? Contact support@opinionplus.online &middot; www.opinionplus.online</div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /payments/packages — now backed by the database (falls back to the
// hardcoded list only if the table is unavailable). Response shape
// (`{ packages: [...] }`) is unchanged.
payments.get('/packages', async (c) => {
  const list = c.env.DB ? await loadPackages(c.env.DB) : PACKAGES;
  return c.json({ packages: list });
});

payments.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
  return c.json({ transactions: results });
});

payments.post('/initialize', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }
  const { packageId, idempotency_key: idempotencyKey } = body || {};

  if (typeof packageId !== 'string') return c.json({ error: 'Invalid package.' }, 400);

  // Package existence + amount are always resolved server-side from the
  // database (falling back to the static list) — the client cannot
  // influence price.
  const pkg = await findPackage(c.env.DB, packageId);
  if (!pkg) return c.json({ error: 'Invalid package.' }, 400);
  if (!isPositiveInt(pkg.amount) || !isPositiveInt(pkg.credits)) return c.json({ error: 'Invalid package configuration.' }, 500);

  const customerEmail = isValidEmail(user?.email) ? user.email : 'support@opinionplus.online';

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  if (idempotencyKey && typeof idempotencyKey === 'string') {
    try {
      const existing = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE idempotency_key = ? AND user_id = ?').bind(idempotencyKey, user.id).first();
      if (existing) {
        if (existing.status === 'completed') return c.json({ reference: existing.reference, email: customerEmail, status: 'completed', credits: existing.credits, idempotent: true });
        if (existing.status === 'pending' && existing.authorization_url) return c.json({ reference: existing.reference, email: customerEmail, authorization_url: existing.authorization_url, access_code: existing.access_code, idempotent: true });
      }
    } catch (e) { logEvent('idempotency_lookup_failed', { message: e.message }); }
  }

  const reference = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const txnId = crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO payment_transactions (id, user_id, amount, credits, method, reference, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(txnId, user.id, pkg.amount, pkg.credits, 'paystack', reference, 'pending', idempotencyKey || null).run();
  } catch (e) {
    await c.env.DB.prepare('INSERT INTO payment_transactions (id, user_id, amount, credits, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(txnId, user.id, pkg.amount, pkg.credits, 'paystack', reference, 'pending').run();
  }

  try {
    const response = await loggedFetch('initialize', 'https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ email: customerEmail, amount: pkg.amount, reference, currency: 'KES', channels: ['card', 'mobile_money'], metadata: { user_id: user.id, transaction_id: txnId, credits: pkg.credits, package: pkg.name, type: 'sms_credits' } }),
    });
    const data = await response.json();
    if (!data.status) {
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?').bind('failed', txnId).run();
      logEvent('payment_init_failed', { reference, message: data.message });
      return c.json({ error: data.message || 'Payment initialization failed.' }, 502);
    }
    try {
      await c.env.DB.prepare('UPDATE payment_transactions SET authorization_url = ?, access_code = ? WHERE id = ?').bind(data.data.authorization_url, data.data.access_code, txnId).run();
    } catch (e) {}
    logEvent('payment_initialized', { actor: user.email, reference, amount: pkg.amount, credits: pkg.credits });
    return c.json({ reference, email: customerEmail, authorization_url: data.data.authorization_url, access_code: data.data.access_code });
  } catch (e) {
    await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?').bind('failed', txnId).run();
    logEvent('payment_init_error', { reference, message: e.message });
    return c.json({ error: 'Payment initialization failed.' }, 500);
  }
});

payments.post('/subscribe/pro', requireAuth, async (c) => {
  const user = c.get('user');
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const customerEmail = isValidEmail(user?.email) ? user.email : 'support@opinionplus.online';

  let idempotencyKey;
  try {
    const body = await c.req.json();
    idempotencyKey = body?.idempotency_key;
  } catch (e) {}

  if (idempotencyKey && typeof idempotencyKey === 'string') {
    try {
      const existing = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE idempotency_key = ? AND user_id = ?').bind(idempotencyKey, user.id).first();
      if (existing) {
        if (existing.status === 'completed') return c.json({ reference: existing.reference, status: 'completed', idempotent: true });
        if (existing.status === 'pending' && existing.authorization_url) return c.json({ authorization_url: existing.authorization_url, reference: existing.reference, access_code: existing.access_code, idempotent: true });
      }
    } catch (e) { logEvent('idempotency_lookup_failed', { message: e.message }); }
  }

  try {
    const requestBody = { email: customerEmail, amount: PRO_PLAN_AMOUNT, currency: 'KES', channels: ['card', 'mobile_money'], metadata: { user_id: user.id, type: 'api_pro_subscription' } };

    const response = await loggedFetch('subscribe_pro', 'https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!data.status) return c.json({ error: data.message || 'Subscription initialization failed.' }, 502);

    if (idempotencyKey && typeof idempotencyKey === 'string') {
      try {
        await c.env.DB.prepare('INSERT INTO payment_transactions (id, user_id, amount, credits, method, reference, status, idempotency_key, authorization_url, access_code) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), user.id, PRO_PLAN_AMOUNT, 'paystack', data.data.reference, 'pending', idempotencyKey, data.data.authorization_url, data.data.access_code).run();
      } catch (e) {}
    }

    return c.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, access_code: data.data.access_code });
  } catch (e) {
    return c.json({ error: 'Subscription initialization failed.' }, 500);
  }
});

payments.get('/api-usage', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role === 'admin' || user.role === 'root') {
    return c.json({ tier: 'pro', calls_today: 0, limit: 'Unlimited', subscription_active: true });
  }
  const usage = await c.env.DB.prepare('SELECT * FROM api_usage WHERE user_id = ?').bind(user.id).first();
  return c.json({
    tier: usage?.tier || 'free',
    calls_today: usage?.calls_today || 0,
    limit: usage?.tier === 'pro' && usage?.subscription_active ? 'Unlimited' : 50,
    subscription_active: !!usage?.subscription_active,
  });
});

payments.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);
  try {
    const response = await loggedFetch('verify', `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
    const data = await response.json();
    if (!data.status) return c.json({ verified: false, message: 'Payment not found.' });

    const txn = data.data;
    if (txn.status === 'success') {
      const type = txn.metadata?.type;
      const userId = txn.metadata?.user_id;

      // Transaction-integrity check: for SMS credit purchases, cross-check
      // the amount Paystack actually charged against what our own pending
      // record expects. A mismatch is treated as a security event and the
      // credits are NOT provisioned.
      if (!type || type === 'sms_credits') {
        const localTxn = await c.env.DB.prepare('SELECT amount, credits FROM payment_transactions WHERE reference = ?').bind(reference).first();
        if (localTxn && Number(localTxn.amount) !== Number(txn.amount)) {
          logEvent('payment_amount_mismatch', { reference, expected: localTxn.amount, received: txn.amount, level: 'warn' });
          await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?').bind('failed', reference, 'pending').run();
          return c.json({ error: 'Transaction amount mismatch detected. Payment not credited.' }, 400);
        }
      }

      if (type === 'api_pro_subscription') {
        await activateProSubscription(c.env.DB, userId);
      } else if (type === 'partner_subscription') {
        await handlePartnerSubscription(c.env.DB, userId, txn.metadata?.tier, txn.metadata?.referral_code);
      } else {
        await finalizeTransaction(c.env.DB, reference, userId, txn.metadata?.credits || 0);
      }
    }
    return c.json({ verified: true, status: txn.status, amount: txn.amount / 100, credits: txn.metadata?.credits || 0, type: txn.metadata?.type, reference });
  } catch (e) {
    return c.json({ error: 'Verification failed.' }, 500);
  }
});

payments.post('/refund', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized.' }, 403);

  const pin = c.req.header('X-Admin-Pin');
  if (!pin) return c.json({ error: 'Admin PIN required.' }, 401);

  // Full SHA-256 validation against ADMIN_PIN_HASH (constant-time compare).
  // Previously this route only checked that the header was present.
  const pinValid = await verifyAdminPin(c, pin);
  if (!pinValid) {
    logEvent('refund_pin_invalid', { actor: user.email, level: 'warn' });
    return c.json({ error: 'Incorrect PIN.' }, 401);
  }

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }
  const { reference, amount } = body || {};

  if (typeof reference !== 'string' || !reference) return c.json({ error: 'A transaction reference is required.' }, 400);
  if (amount !== undefined && !isPositiveInt(amount)) return c.json({ error: 'Refund amount must be a positive integer.' }, 400);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const txn = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE reference = ?').bind(reference).first();
  if (!txn) return c.json({ error: 'Transaction not found.' }, 404);
  if (txn.status === 'refunded') return c.json({ error: 'Transaction already refunded.' }, 400);
  if (txn.status !== 'completed') return c.json({ error: 'Only completed transactions can be refunded.' }, 400);
  if (amount !== undefined && amount > txn.amount) return c.json({ error: 'Refund amount cannot exceed original amount.' }, 400);

  try {
    const response = await loggedFetch('refund', 'https://api.paystack.co/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: reference, ...(amount ? { amount } : {}) }),
    });
    const data = await response.json();
    if (!data.status) {
      logEvent('refund_failed', { reference, message: data.message });
      return c.json({ error: data.message || 'Refund failed.', details: data }, 502);
    }

    // Optimistic lock: only one refund can ever flip a 'completed' txn to
    // 'refunded'. Guards against a duplicate/racing refund request also
    // deducting credits twice.
    const update = await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?')
      .bind('refunded', reference, 'completed').run();
    const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;

    let creditsDeducted = 0;
    if (flipped && txn.credits > 0 && txn.user_id) {
      // Reverse the credits that were granted for this purchase. Balance is
      // clamped at 0 so it can never go negative even if the user has
      // already spent some of the credits.
      await c.env.DB.prepare('UPDATE sms_credits SET balance = MAX(0, balance - ?) WHERE user_id = ?')
        .bind(txn.credits, txn.user_id).run();
      creditsDeducted = txn.credits;
      logEvent('refund_credits_deducted', { reference, user_id: txn.user_id, credits: txn.credits, actor: user.email });
    }

    logEvent('refund_succeeded', { reference, actor: user.email, amount: amount || txn.amount, credits_deducted: creditsDeducted });
    return c.json({ ok: true, refund_id: data.data?.id, amount_refunded: amount || txn.amount, credits_deducted: creditsDeducted });
  } catch (e) {
    logEvent('refund_error', { reference, message: e.message, level: 'error' });
    return c.json({ error: 'Refund failed.' }, 500);
  }
});

payments.get('/receipt/:reference', async (c) => {
  const reference = c.req.param('reference');
  const txn = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE reference = ?').bind(reference).first();
  if (!txn) return c.html('<p>Receipt not found.</p>', 404);
  return c.html(generateReceiptHtml(txn));
});

payments.get('/stats', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized.' }, 403);

  const period = c.req.query('period') || 'all';
  let since = null;
  const now = new Date();
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - 7);
    since = d.toISOString();
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  try {
    const query = since
      ? c.env.DB.prepare('SELECT status, amount FROM payment_transactions WHERE created_at >= ?').bind(since)
      : c.env.DB.prepare('SELECT status, amount FROM payment_transactions');
    const { results } = await query.all();

    const breakdown = { completed: 0, pending: 0, failed: 0, refunded: 0 };
    let totalRevenue = 0;
    for (const row of results) {
      if (breakdown[row.status] !== undefined) breakdown[row.status] += 1;
      if (row.status === 'completed') totalRevenue += Number(row.amount || 0);
    }

    return c.json({ total_revenue: totalRevenue, total_transactions: results.length, period, breakdown });
  } catch (e) {
    return c.json({ error: 'Failed to load stats.' }, 500);
  }
});

// UNIFIED PAYSTACK WEBHOOK HANDLER (Updated to support admin grants & active statuses)
payments.post('/webhook', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  if (!checkWebhookRateLimit(ip)) {
    logEvent('webhook_rate_limited', { ip, level: 'warn' });
    return c.json({ error: 'Too many requests.' }, 429);
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const signature = c.req.header('x-paystack-signature');
  // Raw body MUST be read as text before any JSON parsing — required for
  // HMAC signature verification to match what Paystack signed.
  const rawBody = await c.req.text();

  if (!secretKey) return c.json({ error: 'Not configured.' }, 500);

  const validSignature = await verifyPaystackSignature(secretKey, rawBody, signature);
  if (!validSignature) {
    logEvent('webhook_invalid_signature', { ip, level: 'warn' });
    return c.json({ error: 'SECURITY ALERT: Invalid Signature.' }, 401);
  }

  let body;
  try { body = JSON.parse(rawBody); } catch (e) { return c.json({ error: 'Invalid payload.' }, 400); }

  logEvent('webhook_received', { event: body.event, reference: body.data?.reference, status: body.data?.status });

  // Respond 200 immediately after acknowledging receipt; processing errors
  // are logged separately and do not change the response Paystack sees,
  // so Paystack does not retry-storm on a downstream/database blip.
  if (body.event === 'charge.success') {
    const txn = body.data;
    const metadata = txn.metadata || {};
    const reference = txn.reference;
    const type = metadata.type;
    const userId = metadata.user_id || metadata.userId;

    try {
      if (metadata.serviceType || reference.startsWith('srv_') || reference.startsWith('admin_grant_')) {
        const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE paystack_reference = ?').bind(reference).first();
        if (order) {
          // Idempotent update: only one webhook delivery (of possibly many
          // retried by Paystack) can flip a pending order to active.
          const update = await c.env.DB.prepare(
            'UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND paystack_status = ?'
          ).bind('success', 'active', reference, 'pending').run();

          const changed = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
          if (changed) {
            await provisionServiceFromWebhook(c.env.DB, order);
          } else {
            logEvent('webhook_duplicate_ignored', { reference, order_id: order.id });
          }
        }
        logEvent('webhook_processed', { event: body.event, reference: txn.reference, type: metadata.serviceType || 'service_order' });
      } else {
        if (type === 'api_pro_subscription') {
          await activateProSubscription(c.env.DB, userId);
        } else if (type === 'partner_subscription') {
          await handlePartnerSubscription(c.env.DB, userId, metadata.tier, metadata.referral_code);
        } else {
          await finalizeTransaction(c.env.DB, reference, userId, metadata.credits || 0);
        }
        logEvent('webhook_processed', { event: body.event, reference: txn.reference, type: type || 'sms_credits' });
      }
    } catch (e) {
      logEvent('webhook_processing_error', { event: body.event, reference: txn.reference, message: e.message, level: 'error' });
    }
  }

  return c.json({ received: true });
});

export default payments;
