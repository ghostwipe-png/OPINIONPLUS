// backend/src/routes/payments.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const payments = new Hono();

const PRO_PLAN_AMOUNT = 40000; // KES 400 in cents
const REFERRAL_BONUS = 10000;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Helpers & Cryptography
// ---------------------------------------------------------------------------

async function verifyAdminPin(env, pin) {
  if (!pin || !env.ADMIN_PIN_HASH) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Constant-time string comparison to prevent timing attacks
  if (hex.length !== env.ADMIN_PIN_HASH.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ env.ADMIN_PIN_HASH.charCodeAt(i);
  }
  return diff === 0;
}

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
      request_id: requestId, label: kind,
      endpoint: url.replace(/https:\/\/api\.paystack\.co/, ''),
      status: response.status, duration_ms: Date.now() - start,
    });
    return response;
  } catch (e) {
    logEvent('paystack_api_call_error', {
      request_id: requestId, label: kind,
      endpoint: url.replace(/https:\/\/api\.paystack\.co/, ''),
      duration_ms: Date.now() - start, message: e.message,
    });
    throw e;
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

// SERVICE PROVISIONING HELPER (Optimistic Locking)
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
    
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
    }
    return diff === 0;
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

payments.get('/packages', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, name, price_kes_cents as amount, sms_count as credits FROM sms_packages WHERE is_active = 1').all();
    return c.json({ packages: results });
  } catch (e) {
    return c.json({ error: 'Failed to load packages.' }, 500);
  }
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
  
  // DYNAMIC PACKAGE VALIDATION: Fetch from DB securely
  const pkg = await c.env.DB.prepare('SELECT id, name, price_kes_cents as amount, sms_count as credits FROM sms_packages WHERE id = ? AND is_active = 1').bind(packageId).first();
  if (!pkg) return c.json({ error: 'Invalid or inactive package.' }, 400);
  if (pkg.amount <= 0 || pkg.credits <= 0) return c.json({ error: 'Invalid package configuration.' }, 500);
  
  const customerEmail = isValidEmail(user?.email) ? user.email : 'support@opinionplus.online';

  if (!isPositiveInt(pkg.amount) || !isPositiveInt(pkg.credits)) return c.json({ error: 'Invalid package configuration.' }, 500);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  // STRICT IDEMPOTENCY
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
      return c.json({ error: data.message || 'Payment initialization failed.', details: data }, 502);
    }
    try {
      await c.env.DB.prepare('UPDATE payment_transactions SET authorization_url = ?, access_code = ? WHERE id = ?').bind(data.data.authorization_url, data.data.access_code, txnId).run();
    } catch (e) {}
    return c.json({ reference, email: customerEmail, authorization_url: data.data.authorization_url, access_code: data.data.access_code });
  } catch (e) {
    await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?').bind('failed', txnId).run();
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
      // Validate Integrity before finalizing
      const type = txn.metadata?.type;
      const userId = txn.metadata?.user_id;
      
      const localTxn = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE reference = ?').bind(reference).first();
      if (localTxn && localTxn.amount !== txn.amount) {
         logEvent('security_alert_amount_mismatch', { reference, local: localTxn.amount, remote: txn.amount });
         return c.json({ error: 'Transaction integrity failure.' }, 400);
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

  // SECURE PIN VALIDATION (SHA-256)
  const pin = c.req.header('X-Admin-Pin');
  const isValidPin = await verifyAdminPin(c.env, pin);
  if (!isValidPin) return c.json({ error: 'Incorrect or missing PIN.' }, 401);

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
    
    // ATOMIC REFUND DEDUCTION
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE reference = ?').bind('refunded', reference),
      // Deduct credits to prevent free SMS exploitation on refund
      c.env.DB.prepare('UPDATE sms_credits SET balance = MAX(0, balance - ?) WHERE user_id = ?').bind(txn.credits || 0, txn.user_id)
    ]);
    
    logEvent('refund_succeeded', { reference, actor: user.email, amount: amount || txn.amount, credits_deducted: txn.credits });
    return c.json({ ok: true, refund_id: data.data?.id, amount_refunded: amount || txn.amount });
  } catch (e) {
    logEvent('refund_error', { reference, message: e.message });
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

// UNIFIED PAYSTACK WEBHOOK HANDLER (Strict Validation & Anti-Double-Provision)
payments.post('/webhook', async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const signature = c.req.header('x-paystack-signature');
  const rawBody = await c.req.text();

  if (!secretKey) return c.json({ error: 'Not configured.' }, 500);

  const validSignature = await verifyPaystackSignature(secretKey, rawBody, signature);
  if (!validSignature) {
    logEvent('security_alert_invalid_webhook_signature', { ip: c.req.header('CF-Connecting-IP') });
    return c.json({ error: 'SECURITY ALERT: Invalid Signature.' }, 401);
  }

  let body;
  try { body = JSON.parse(rawBody); } catch (e) { return c.json({ error: 'Invalid payload.' }, 400); }

  logEvent('webhook_received', { event: body.event, reference: body.data?.reference, status: body.data?.status });

  if (body.event === 'charge.success') {
    const txn = body.data;
    const metadata = txn.metadata || {};
    const reference = txn.reference;
    const type = metadata.type;
    const userId = metadata.user_id || metadata.userId;

    try {
      if (metadata.serviceType || reference.startsWith('srv_') || reference.startsWith('admin_grant_')) {
        const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE paystack_reference = ?').bind(reference).first();
        // OPTIMISTIC LOCKING: Check if status is pending AND update where pending
        if (order && (order.paystack_status === 'pending' || order.status === 'pending')) {
          const update = await c.env.DB.prepare(
            'UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND (paystack_status = ? OR status = ?)'
          ).bind('success', 'active', reference, 'pending', 'pending').run();

          const changed = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
          if (changed) {
            await provisionServiceFromWebhook(c.env.DB, order);
          } else {
             logEvent('webhook_double_process_prevented', { reference });
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
      logEvent('webhook_error', { event: body.event, reference: txn.reference, message: e.message });
    }
  }
  
  return c.json({ received: true });
});

export default payments;