import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const partner = new Hono();

const PARTNER_PRICE = 50000; // KES 500 in kobo
const PRO_PRICE = 80000; // KES 800 in kobo
const REFERRAL_BONUS = 10000; // KES 100 in kobo
const ENGAGEMENT_BONUS_50 = 1000; // KES 10
const ENGAGEMENT_BONUS_100 = 2000; // KES 20
const MIN_WITHDRAWAL = 10000; // KES 100
const WITHDRAWAL_FEE = 500; // KES 5

// Get wallet balance
partner.get('/wallet', requireAuth, async (c) => {
  const user = c.get('user');
  let wallet = await c.env.DB.prepare('SELECT * FROM wallets WHERE user_id = ?').bind(user.id).first();
  if (!wallet) {
    await c.env.DB.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0)').bind(user.id).run();
    wallet = { balance: 0, total_earned: 0, total_withdrawn: 0 };
  }
  const referrals = await c.env.DB.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').bind(user.id).first();
  return c.json({ ...wallet, referral_count: referrals.count, tier: user.tier || 'basic' });
});

// Generate referral code
partner.get('/referral-code', requireAuth, async (c) => {
  const user = c.get('user');
  let code = user.referral_code;
  if (!code) {
    code = `${user.publisher_name?.replace(/\s+/g, '').toLowerCase() || 'user'}_${user.id.slice(0, 8)}`;
    await c.env.DB.prepare('UPDATE users SET referral_code = ? WHERE id = ?').bind(code, user.id).run();
  }
  return c.json({ code, link: `https://www.opinionplus.online/signup?ref=${code}` });
});

// Get earnings history
partner.get('/earnings', requireAuth, async (c) => {
  const user = c.get('user');
  const [referrals, posts, withdrawals] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all(),
    c.env.DB.prepare('SELECT * FROM post_earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all(),
    c.env.DB.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').bind(user.id).all(),
  ]);
  return c.json({
    referrals: referrals.results,
    posts: posts.results,
    withdrawals: withdrawals.results,
  });
});

// Subscribe to Partner
partner.post('/subscribe/partner', requireAuth, async (c) => {
  const user = c.get('user');
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const { ref } = await c.req.json().catch(() => ({}));

  const reference = `partner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    email: user.email,
    amount: PARTNER_PRICE,
    reference,
    currency: 'KES',
    channels: ['card', 'mobile_money'],
    metadata: {
      user_id: user.id,
      type: 'partner_subscription',
      tier: 'partner',
      referral_code: ref || null,
    },
  };

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.status) return c.json({ error: data.message }, 502);

  return c.json({ authorization_url: data.data.authorization_url, access_code: data.data.access_code, reference });
});

// Subscribe to Pro Partner
partner.post('/subscribe/pro', requireAuth, async (c) => {
  const user = c.get('user');
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const { ref } = await c.req.json().catch(() => ({}));

  const reference = `pro_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    email: user.email,
    amount: PRO_PRICE,
    reference,
    currency: 'KES',
    channels: ['card', 'mobile_money'],
    metadata: {
      user_id: user.id,
      type: 'partner_subscription',
      tier: 'pro_partner',
      referral_code: ref || null,
    },
  };

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.status) return c.json({ error: data.message }, 502);

  return c.json({ authorization_url: data.data.authorization_url, access_code: data.data.access_code, reference });
});

// Request withdrawal
partner.post('/withdraw', requireAuth, async (c) => {
  const user = c.get('user');
  const { amount, phone } = await c.req.json();

  if (!amount || amount < MIN_WITHDRAWAL) {
    return c.json({ error: `Minimum withdrawal is KES ${MIN_WITHDRAWAL / 100}.` }, 400);
  }
  if (!phone || !phone.match(/^\+?254\d{9}$/)) {
    return c.json({ error: 'Valid Kenyan phone number required (e.g., +254712345678).' }, 400);
  }

  const wallet = await c.env.DB.prepare('SELECT * FROM wallets WHERE user_id = ?').bind(user.id).first();
  if (!wallet || wallet.balance < amount) {
    return c.json({ error: 'Insufficient balance.' }, 400);
  }

  const totalAmount = amount + WITHDRAWAL_FEE;
  if (wallet.balance < totalAmount) {
    return c.json({ error: `Insufficient balance. Withdrawal fee is KES ${WITHDRAWAL_FEE / 100}.` }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO withdrawals (id, user_id, amount, phone, status) VALUES (?, ?, ?, ?, ?)')
    .bind(id, user.id, amount, phone, 'pending').run();

  await c.env.DB.prepare('UPDATE wallets SET balance = balance - ?, total_withdrawn = total_withdrawn + ? WHERE user_id = ?')
    .bind(totalAmount, amount, user.id).run();

  return c.json({ id, amount, fee: WITHDRAWAL_FEE, status: 'pending', message: 'Withdrawal queued. Will be processed within 24 hours.' });
});

export default partner;