import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const payments = new Hono();

// Credit packages
const PACKAGES = [
  { id: 'sms_10', name: '10 SMS', amount: 1000, credits: 10 },
  { id: 'sms_50', name: '50 SMS', amount: 5000, credits: 50 },
  { id: 'sms_100', name: '100 SMS', amount: 10000, credits: 100 },
  { id: 'sms_500', name: '500 SMS', amount: 50000, credits: 500 },
  { id: 'sms_1000', name: '1000 SMS', amount: 100000, credits: 1000 },
];

const PRO_PLAN_CODE = 'PLN_gilbf69mzasj1q6';
const PRO_PLAN_AMOUNT = 30000;

const REFERRAL_BONUS = 10000; // KES 100 in kobo

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function finalizeTransaction(db, reference, expectedUserId, credits) {
  const update = await db
    .prepare('UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?')
    .bind('completed', reference, 'pending')
    .run();
  const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
  if (!flipped) return { credited: false };
  if (!expectedUserId || !credits) return { credited: false };
  await db
    .prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
    .bind(expectedUserId, credits, credits)
    .run();
  return { credited: true };
}

async function activateProSubscription(db, userId, planCode, subscriptionCode) {
  await db
    .prepare(`INSERT INTO api_usage (user_id, tier, subscription_active, plan_code, subscription_code) VALUES (?, 'pro', 1, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = 'pro', subscription_active = 1, plan_code = ?, subscription_code = ?`)
    .bind(userId, planCode, subscriptionCode, planCode, subscriptionCode)
    .run();
}

async function handlePartnerSubscription(db, userId, tier, referralCode) {
  await db.prepare('UPDATE users SET tier = ? WHERE id = ?').bind(tier, userId).run();
  await db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();

  if (referralCode) {
    const referrer = await db.prepare('SELECT * FROM users WHERE referral_code = ?').bind(referralCode).first();
    if (referrer && referrer.id !== userId) {
      const existing = await db.prepare('SELECT * FROM referrals WHERE referred_id = ?').bind(userId).first();
      if (!existing) {
        await db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, bonus_paid) VALUES (?, ?, ?, ?)')
          .bind(crypto.randomUUID(), referrer.id, userId, REFERRAL_BONUS).run();
        await db.prepare('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?')
          .bind(REFERRAL_BONUS, REFERRAL_BONUS, referrer.id).run();
      }
    }
  }
}

async function verifyPaystackSignature(secretKey, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const computedHex = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (computedHex.length !== signatureHeader.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) diff |= computedHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
    return diff === 0;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

payments.get('/packages', (c) => c.json({ packages: PACKAGES }));

payments.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
  return c.json({ transactions: results });
});

payments.post('/initialize', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }
  const { packageId } = body || {};
  if (typeof packageId !== 'string') return c.json({ error: 'Invalid package.' }, 400);
  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return c.json({ error: 'Invalid package.' }, 400);
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const reference = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const txnId = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO payment_transactions (id, user_id, amount, credits, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(txnId, user.id, pkg.amount, pkg.credits, 'paystack', reference, 'pending').run();

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ email: user.email, amount: pkg.amount, reference, currency: 'KES', channels: ['card', 'mobile_money'], metadata: { user_id: user.id, transaction_id: txnId, credits: pkg.credits, package: pkg.name, type: 'sms_credits' } }),
    });
    const data = await response.json();
    if (!data.status) {
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?').bind('failed', txnId).run();
      return c.json({ error: data.message || 'Payment initialization failed.', details: data }, 502);
    }
    return c.json({ reference, email: user.email, authorization_url: data.data.authorization_url, access_code: data.data.access_code });
  } catch (e) {
    await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?').bind('failed', txnId).run();
    return c.json({ error: 'Payment initialization failed.' }, 500);
  }
});

payments.post('/subscribe/pro', requireAuth, async (c) => {
  const user = c.get('user');
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);
  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, amount: PRO_PLAN_AMOUNT, plan: PRO_PLAN_CODE, currency: 'KES', metadata: { user_id: user.id, type: 'api_pro_subscription' } }),
    });
    const data = await response.json();
    if (!data.status) return c.json({ error: data.message || 'Subscription initialization failed.' }, 502);
    return c.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, access_code: data.data.access_code });
  } catch (e) {
    return c.json({ error: 'Subscription initialization failed.' }, 500);
  }
});

payments.get('/api-usage', requireAuth, async (c) => {
  const user = c.get('user');
  const usage = await c.env.DB.prepare('SELECT * FROM api_usage WHERE user_id = ?').bind(user.id).first();
  return c.json({ tier: usage?.tier || 'free', calls_today: usage?.calls_today || 0, limit: usage?.tier === 'pro' && usage?.subscription_active ? 'Unlimited' : 50, subscription_active: !!usage?.subscription_active });
});

payments.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
    const data = await response.json();
    if (!data.status) return c.json({ verified: false, message: 'Payment not found.' });
    const txn = data.data;
    if (txn.status === 'success') {
      const type = txn.metadata?.type;
      const userId = txn.metadata?.user_id;
      if (type === 'api_pro_subscription') {
        await activateProSubscription(c.env.DB, userId, txn.plan, txn.subscription_code);
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

payments.post('/webhook', async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const signature = c.req.header('x-paystack-signature');
  const rawBody = await c.req.text();
  if (!secretKey) return c.json({ received: true });
  const validSignature = await verifyPaystackSignature(secretKey, rawBody, signature);
  if (!validSignature) return c.json({ error: 'Invalid signature.' }, 401);
  let body;
  try { body = JSON.parse(rawBody); } catch (e) { return c.json({ error: 'Invalid payload.' }, 400); }

  if (body.event === 'charge.success') {
    const txn = body.data;
    const type = txn.metadata?.type;
    const userId = txn.metadata?.user_id;
    try {
      if (type === 'api_pro_subscription') {
        await activateProSubscription(c.env.DB, userId, txn.plan, txn.subscription_code);
      } else if (type === 'partner_subscription') {
        await handlePartnerSubscription(c.env.DB, userId, txn.metadata?.tier, txn.metadata?.referral_code);
      } else {
        await finalizeTransaction(c.env.DB, txn.reference, userId, txn.metadata?.credits || 0);
      }
    } catch (e) { console.error('PAYSTACK WEBHOOK - error:', e.message); }
  }
  return c.json({ received: true });
});

export default payments;