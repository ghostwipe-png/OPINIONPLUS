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
const MAX_WITHDRAWALS_PER_DAY = 3;

// Get wallet balance
partner.get('/wallet', requireAuth, async (c) => {
  const user = c.get('user');

  // Admins get auto-pro
  if (user.role === 'admin' || user.role === 'root') {
    await c.env.DB.prepare('UPDATE users SET tier = ? WHERE id = ? AND tier = ?')
      .bind('pro_partner', user.id, 'basic').run();
    await c.env.DB.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING')
      .bind(user.id).run();
  }

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

  // Anti-fraud: require at least one completed referral before a partner can withdraw.
  const referralCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').bind(user.id).first();
  if (!referralCount || referralCount.count < 1) {
    return c.json({ error: 'You need at least one completed referral before you can withdraw.' }, 400);
  }

  // Anti-fraud: cap withdrawals per rolling 24h window.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentWithdrawals = await c.env.DB.prepare('SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ? AND created_at >= ?').bind(user.id, since).first();
  if (recentWithdrawals && recentWithdrawals.count >= MAX_WITHDRAWALS_PER_DAY) {
    return c.json({ error: `You can request at most ${MAX_WITHDRAWALS_PER_DAY} withdrawals per day.` }, 429);
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
  const withdrawalReference = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await c.env.DB.prepare('INSERT INTO withdrawals (id, user_id, amount, phone, status, withdrawal_reference) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, amount, phone, 'pending', withdrawalReference).run();
  } catch (e) {
    // Fallback for schemas without the withdrawal_reference column yet.
    await c.env.DB.prepare('INSERT INTO withdrawals (id, user_id, amount, phone, status) VALUES (?, ?, ?, ?, ?)')
      .bind(id, user.id, amount, phone, 'pending').run();
  }

  await c.env.DB.prepare('UPDATE wallets SET balance = balance - ?, total_withdrawn = total_withdrawn + ? WHERE user_id = ?')
    .bind(totalAmount, amount, user.id).run();

  return c.json({ id, amount, fee: WITHDRAWAL_FEE, status: 'pending', reference: withdrawalReference, message: 'Withdrawal queued. Will be processed within 24 hours.' });
});

// Mark withdrawal as completed (admin only)
partner.post('/withdrawal/:id/complete', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') {
    return c.json({ error: 'Unauthorized.' }, 403);
  }
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE withdrawals SET status = ? WHERE id = ?').bind('completed', id).run();
  return c.json({ ok: true });
});

// -----------------------------------------------------------------------
// NEW: Admin-only earnings statistics
// -----------------------------------------------------------------------
partner.get('/stats', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized.' }, 403);

  try {
    const [earned, withdrawn, pending, referrals, activePartners] = await Promise.all([
      c.env.DB.prepare('SELECT COALESCE(SUM(total_earned), 0) as total FROM wallets').first(),
      c.env.DB.prepare('SELECT COALESCE(SUM(total_withdrawn), 0) as total FROM wallets').first(),
      c.env.DB.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'pending'").first(),
      c.env.DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(bonus_paid), 0) as bonus_total FROM referrals').first(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE tier IN ('partner', 'pro_partner')").first(),
    ]);

    return c.json({
      total_earned: earned?.total || 0,
      total_withdrawn: withdrawn?.total || 0,
      total_pending: pending?.total || 0,
      total_referrals: referrals?.count || 0,
      total_referral_bonus_paid: referrals?.bonus_total || 0,
      active_partners_count: activePartners?.count || 0,
    });
  } catch (e) {
    console.error('PARTNER STATS ERROR:', e.message);
    return c.json({ error: 'Failed to load partner stats.' }, 500);
  }
});

// -----------------------------------------------------------------------
// NEW: Admin-only bulk processing of pending withdrawals
// (Marks them 'processing' — hook up real M-Pesa B2C disbursement here later.)
// -----------------------------------------------------------------------
partner.post('/withdraw/auto', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized.' }, 403);

  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM withdrawals WHERE status = 'pending'").all();
    if (!results.length) return c.json({ processed: 0, total_amount: 0 });

    const totalAmount = results.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    await c.env.DB.prepare("UPDATE withdrawals SET status = 'processing' WHERE status = 'pending'").run();

    return c.json({ processed: results.length, total_amount: totalAmount });
  } catch (e) {
    console.error('PARTNER AUTO-WITHDRAW ERROR:', e.message);
    return c.json({ error: 'Failed to process withdrawals.' }, 500);
  }
});

// -----------------------------------------------------------------------
// NEW: Public monthly leaderboard of top earners
// -----------------------------------------------------------------------
partner.get('/leaderboard', async (c) => {
  try {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    const { results } = await c.env.DB.prepare(
      `SELECT u.publisher_name as name, COALESCE(SUM(r.bonus_paid), 0) as amount, COUNT(r.id) as referrals
       FROM users u
       LEFT JOIN referrals r ON r.referrer_id = u.id AND r.created_at >= ?
       WHERE u.tier IN ('partner', 'pro_partner')
       GROUP BY u.id
       ORDER BY amount DESC
       LIMIT 10`
    ).bind(since.toISOString()).all();

    return c.json({ leaders: (results || []).map(r => ({ name: r.name || 'Anonymous', amount: r.amount || 0, referrals: r.referrals || 0 })) });
  } catch (e) {
    console.error('PARTNER LEADERBOARD ERROR:', e.message);
    return c.json({ leaders: [] });
  }
});

export default partner;
