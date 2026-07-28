import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const partner = new Hono();

// ── Money constants (all integer KES cents — never floats) ──────────────
const PARTNER_PRICE = 50000;         // KES 500
const PRO_PRICE = 80000;             // KES 800

const REFERRAL_BONUS = 10000;        // KES 100 — kept for back-compat with existing callers
const REFERRAL_BONUS_BASIC = 10000;  // KES 100
const REFERRAL_BONUS_PARTNER = 30000; // KES 300
const REFERRAL_BONUS_PRO = 50000;    // KES 500
const REFERRAL_MLM_RATE = 0.10;      // 10% of a referred partner's own earnings, one level up

const ENGAGEMENT_BONUS_50 = 1000;    // KES 10
const ENGAGEMENT_BONUS_100 = 2000;   // KES 20
const ENGAGEMENT_BONUS_500 = 5000;   // KES 50
const ENGAGEMENT_BONUS_1000 = 10000; // KES 100

const QUALITY_BONUS_GOLD = 5000;     // KES 50
const QUALITY_BONUS_SILVER = 2500;   // KES 25
const LIKES_BONUS_50 = 3000;         // KES 30
const COMMENTS_BONUS_20 = 2000;      // KES 20

const RECURRING_RATE_SMS = 0.05;
const RECURRING_RATE_PRESS = 0.03;
const RECURRING_RATE_SPONSORED = 0.05;

const PLATFORM_FEE_REFERRAL = 0.15;
const PLATFORM_FEE_ENGAGEMENT = 0.20;
const PLATFORM_FEE_RECURRING = 0.10;

const MIN_WITHDRAWAL = 10000;         // KES 100
const WITHDRAWAL_FEE = 500;           // KES 5 — Bronze default; tiers override (see TIER_CONFIG)
const MAX_WITHDRAWALS_PER_DAY = 3;

const HIGH_EARNINGS_ALERT_THRESHOLD = 500000; // KES 5,000 / 24h

const TIER_CONFIG = {
  bronze:   { min: 0,  multiplier: 1.0,  fee: 500 },
  silver:   { min: 6,  multiplier: 1.1,  fee: 300 },
  gold:     { min: 21, multiplier: 1.25, fee: 100 },
  platinum: { min: 51, multiplier: 1.5,  fee: 0 },
};

function tierForReferralCount(count) {
  if (count >= TIER_CONFIG.platinum.min) return 'platinum';
  if (count >= TIER_CONFIG.gold.min) return 'gold';
  if (count >= TIER_CONFIG.silver.min) return 'silver';
  return 'bronze';
}

// ── Safe DB wrappers — every query goes through these so a bad query
//    degrades a single feature instead of crashing the route. ───────────
async function safeDbFirst(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).first(); }
  catch (e) { console.error('DB_FIRST_ERROR:', sql, e.message); return null; }
}
async function safeDbAll(env, sql, ...params) {
  try { return (await env.DB.prepare(sql).bind(...params).all()).results || []; }
  catch (e) { console.error('DB_ALL_ERROR:', sql, e.message); return []; }
}
async function safeDbRun(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).run(); }
  catch (e) { console.error('DB_RUN_ERROR:', sql, e.message); return null; }
}

function isAdmin(user) {
  return !!user && (user.role === 'admin' || user.role === 'root');
}

// ── Ledger + wallet — optimistic locking so concurrent earning events
//    can never lose an update or double-spend a balance. ────────────────
// Returns { ok, balance } or { ok: false, error }.
async function creditWallet(env, { userId, earningType, amountCents, referenceId = null, platformFeeRate = 0, note = null, createdBy = null }) {
  if (!userId || !amountCents || amountCents <= 0) return { ok: false, error: 'Invalid credit.' };

  const platformFee = Math.round(amountCents * platformFeeRate);
  const netAmount = amountCents - platformFee;

  for (let attempt = 0; attempt < 5; attempt++) {
    let wallet = await safeDbFirst(env, 'SELECT * FROM wallets WHERE user_id = ?', userId);
    if (!wallet) {
      await safeDbRun(env, 'INSERT INTO wallets (user_id, balance, version, total_earned, total_withdrawn) VALUES (?, 0, 0, 0, 0) ON CONFLICT(user_id) DO NOTHING', userId);
      wallet = await safeDbFirst(env, 'SELECT * FROM wallets WHERE user_id = ?', userId);
      if (!wallet) return { ok: false, error: 'Could not create wallet.' };
    }
    if (wallet.is_frozen) return { ok: false, error: 'Wallet is frozen.' };

    const currentVersion = wallet.version || 0;
    const newBalance = (wallet.balance || 0) + netAmount;
    const newTotalEarned = (wallet.total_earned || 0) + netAmount;

    const result = await safeDbRun(
      env,
      'UPDATE wallets SET balance = ?, total_earned = ?, version = ? WHERE user_id = ? AND version = ?',
      newBalance, newTotalEarned, currentVersion + 1, userId, currentVersion
    );
    if (!result || result.meta?.changes !== 1) continue; // lost the race — retry

    const ledgerId = crypto.randomUUID();
    await safeDbRun(
      env,
      'INSERT INTO earnings_ledger (id, user_id, earning_type, amount_kes_cents, reference_id, running_balance, platform_fee_kes_cents, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ledgerId, userId, earningType, netAmount, referenceId, newBalance, platformFee, note, createdBy
    );
    if (platformFee > 0) {
      await safeDbRun(
        env,
        'INSERT INTO platform_revenue (id, source, amount_kes_cents, reference_id) VALUES (?, ?, ?, ?)',
        crypto.randomUUID(), `${earningType}_fee`, platformFee, referenceId
      );
    }

    await maybeFlagHighEarnings(env, userId);
    return { ok: true, balance: newBalance, ledgerId };
  }
  return { ok: false, error: 'Could not update wallet after retries — please try again.' };
}

async function maybeFlagHighEarnings(env, userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = await safeDbFirst(
    env,
    'SELECT COALESCE(SUM(amount_kes_cents), 0) as total FROM earnings_ledger WHERE user_id = ? AND created_at >= ? AND amount_kes_cents > 0',
    userId, since
  );
  if (row && row.total > HIGH_EARNINGS_ALERT_THRESHOLD) {
    await safeDbRun(
      env,
      'INSERT INTO admin_alerts (id, alert_type, user_id, severity, detail) VALUES (?, ?, ?, ?, ?)',
      crypto.randomUUID(), 'high_earnings', userId, 'high', `Earned ${row.total} cents in the last 24h`
    );
  }
}

// ── Get wallet balance ───────────────────────────────────────────────────
partner.get('/wallet', requireAuth, async (c) => {
  const user = c.get('user');

  if (isAdmin(user)) {
    await safeDbRun(c.env, 'UPDATE users SET tier = ? WHERE id = ? AND tier = ?', 'pro_partner', user.id, 'basic');
    await safeDbRun(c.env, 'INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING', user.id);
  }

  let wallet = await safeDbFirst(c.env, 'SELECT * FROM wallets WHERE user_id = ?', user.id);
  if (!wallet) {
    await safeDbRun(c.env, 'INSERT INTO wallets (user_id, balance) VALUES (?, 0)', user.id);
    wallet = { balance: 0, total_earned: 0, total_withdrawn: 0 };
  }
  const referrals = await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', user.id);
  return c.json({
    ...wallet,
    referral_count: referrals?.count || 0,
    tier: user.tier || 'basic',
    partner_tier: user.partner_tier || 'bronze',
    is_frozen: !!wallet.is_frozen,
  });
});

// ── Generate referral code ──────────────────────────────────────────────
partner.get('/referral-code', requireAuth, async (c) => {
  const user = c.get('user');
  let code = user.referral_code;
  if (!code) {
    code = `${user.publisher_name?.replace(/\s+/g, '').toLowerCase() || 'user'}_${user.id.slice(0, 8)}`;
    await safeDbRun(c.env, 'UPDATE users SET referral_code = ? WHERE id = ?', code, user.id);
  }
  return c.json({ code, link: `https://www.opinionplus.online/signup?ref=${code}` });
});

// Public: record a referral link click (for conversion analytics). Called
// from the signup landing page before the visitor has an account.
partner.post('/referral-click', async (c) => {
  const { ref } = await c.req.json().catch(() => ({}));
  if (!ref) return c.json({ ok: false }, 400);
  const referrer = await safeDbFirst(c.env, 'SELECT id FROM users WHERE referral_code = ?', ref);
  if (!referrer) return c.json({ ok: false }, 404);

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  if (!(await limiter(ip, 'referral-click'))) return c.json({ ok: false }, 429);

  await safeDbRun(
    c.env,
    'INSERT INTO referral_clicks (id, referrer_id, ip_address, user_agent) VALUES (?, ?, ?, ?)',
    crypto.randomUUID(), referrer.id, ip, c.req.header('User-Agent') || ''
  );
  return c.json({ ok: true });
});

// ── Get earnings history ─────────────────────────────────────────────────
partner.get('/earnings', requireAuth, async (c) => {
  const user = c.get('user');
  const [referrals, posts, withdrawals] = await Promise.all([
    safeDbAll(c.env, 'SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 50', user.id),
    safeDbAll(c.env, 'SELECT * FROM post_earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', user.id),
    safeDbAll(c.env, 'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', user.id),
  ]);
  return c.json({ referrals, posts, withdrawals });
});

// ── Subscribe to Partner ─────────────────────────────────────────────────
// PAYMENT: Uncomment when ready to charge. Platform runs FREE for now —
// this route grants the 'partner' tier directly with no Paystack charge.
partner.post('/subscribe/partner', requireAuth, async (c) => {
  const user = c.get('user');
  const { ref } = await c.req.json().catch(() => ({}));
  const reference = `partner_free_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await safeDbRun(c.env, "UPDATE users SET tier = 'partner' WHERE id = ?", user.id);
  await safeDbRun(c.env, 'INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING', user.id);
  if (ref) {
    const referrer = await safeDbFirst(c.env, 'SELECT id FROM users WHERE referral_code = ?', ref);
    if (referrer && referrer.id !== user.id) {
      await safeDbRun(c.env, 'UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL', referrer.id, user.id);
    }
  }

  /* PAYMENT: Uncomment when ready to charge.
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const body = {
    email: user.email,
    amount: PARTNER_PRICE,
    reference,
    currency: 'KES',
    channels: ['card', 'mobile_money'],
    metadata: { user_id: user.id, type: 'partner_subscription', tier: 'partner', referral_code: ref || null },
  };
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.status) return c.json({ error: data.message }, 502);
  return c.json({ authorization_url: data.data.authorization_url, access_code: data.data.access_code, reference });
  */

  return c.json({ ok: true, tier: 'partner', reference, message: 'Partner subscription activated (free tier — payments currently disabled).' });
});

// ── Subscribe to Pro Partner ─────────────────────────────────────────────
// PAYMENT: Uncomment when ready to charge. Platform runs FREE for now —
// this route grants the 'pro_partner' tier directly with no Paystack charge.
partner.post('/subscribe/pro', requireAuth, async (c) => {
  const user = c.get('user');
  const { ref } = await c.req.json().catch(() => ({}));
  const reference = `pro_free_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await safeDbRun(c.env, "UPDATE users SET tier = 'pro_partner' WHERE id = ?", user.id);
  await safeDbRun(c.env, 'INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING', user.id);
  if (ref) {
    const referrer = await safeDbFirst(c.env, 'SELECT id FROM users WHERE referral_code = ?', ref);
    if (referrer && referrer.id !== user.id) {
      await safeDbRun(c.env, 'UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL', referrer.id, user.id);
    }
  }

  /* PAYMENT: Uncomment when ready to charge.
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const body = {
    email: user.email,
    amount: PRO_PRICE,
    reference,
    currency: 'KES',
    channels: ['card', 'mobile_money'],
    metadata: { user_id: user.id, type: 'partner_subscription', tier: 'pro_partner', referral_code: ref || null },
  };
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.status) return c.json({ error: data.message }, 502);
  return c.json({ authorization_url: data.data.authorization_url, access_code: data.data.access_code, reference });
  */

  return c.json({ ok: true, tier: 'pro_partner', reference, message: 'Pro Partner subscription activated (free tier — payments currently disabled).' });
});

// ── Request withdrawal ───────────────────────────────────────────────────
partner.post('/withdraw', requireAuth, async (c) => {
  const user = c.get('user');
  const { amount, phone, idempotency_key } = await c.req.json();

  if (!amount || amount < MIN_WITHDRAWAL) {
    return c.json({ error: `Minimum withdrawal is KES ${MIN_WITHDRAWAL / 100}.` }, 400);
  }
  if (!phone || !phone.match(/^\+?254\d{9}$/)) {
    return c.json({ error: 'Valid Kenyan phone number required (e.g., +254712345678).' }, 400);
  }

  // Idempotency — replaying the same key returns the original result instead of double-withdrawing.
  if (idempotency_key) {
    const existing = await safeDbFirst(c.env, 'SELECT withdrawal_id FROM withdrawal_idempotency WHERE idempotency_key = ? AND user_id = ?', idempotency_key, user.id);
    if (existing) {
      const w = await safeDbFirst(c.env, 'SELECT * FROM withdrawals WHERE id = ?', existing.withdrawal_id);
      if (w) return c.json({ id: w.id, amount: w.amount, fee: WITHDRAWAL_FEE, status: w.status, reference: w.withdrawal_reference, message: 'Withdrawal already queued.', replayed: true });
    }
  }

  // 1 withdrawal request per minute per user (new — on top of the existing daily cap).
  const oneMinLimiter = createRateLimiter(c.env.DB, 60, 1);
  if (!(await oneMinLimiter(user.id, 'withdraw-request'))) {
    return c.json({ error: 'Please wait a moment before requesting another withdrawal.' }, 429);
  }

  const referralCount = await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', user.id);
  if (!referralCount || referralCount.count < 1) {
    return c.json({ error: 'You need at least one completed referral before you can withdraw.' }, 400);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentWithdrawals = await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ? AND created_at >= ?', user.id, since);
  if (recentWithdrawals && recentWithdrawals.count >= MAX_WITHDRAWALS_PER_DAY) {
    return c.json({ error: `You can request at most ${MAX_WITHDRAWALS_PER_DAY} withdrawals per day.` }, 429);
  }

  const tierFee = TIER_CONFIG[user.partner_tier]?.fee ?? WITHDRAWAL_FEE;
  const totalAmount = amount + tierFee;

  // Optimistic-lock the debit so a double-submit can never take the balance negative.
  let wallet, updateResult;
  for (let attempt = 0; attempt < 5; attempt++) {
    wallet = await safeDbFirst(c.env, 'SELECT * FROM wallets WHERE user_id = ?', user.id);
    if (!wallet || wallet.is_frozen) return c.json({ error: wallet?.is_frozen ? 'Wallet is frozen. Contact support.' : 'Wallet not found.' }, 400);
    if (wallet.balance < totalAmount) {
      return c.json({ error: `Insufficient balance. Withdrawal fee is KES ${tierFee / 100}.` }, 400);
    }
    const version = wallet.version || 0;
    updateResult = await safeDbRun(
      c.env,
      'UPDATE wallets SET balance = MAX(0, balance - ?), total_withdrawn = total_withdrawn + ?, version = ? WHERE user_id = ? AND version = ?',
      totalAmount, amount, version + 1, user.id, version
    );
    if (updateResult && updateResult.meta?.changes === 1) break;
    updateResult = null;
  }
  if (!updateResult) return c.json({ error: 'Could not process withdrawal — please try again.' }, 409);

  const id = crypto.randomUUID();
  const withdrawalReference = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await c.env.DB.prepare('INSERT INTO withdrawals (id, user_id, amount, phone, status, withdrawal_reference) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, amount, phone, 'pending', withdrawalReference).run();
  } catch (e) {
    await c.env.DB.prepare('INSERT INTO withdrawals (id, user_id, amount, phone, status) VALUES (?, ?, ?, ?, ?)')
      .bind(id, user.id, amount, phone, 'pending').run();
  }

  if (idempotency_key) {
    await safeDbRun(c.env, 'INSERT INTO withdrawal_idempotency (idempotency_key, user_id, withdrawal_id) VALUES (?, ?, ?)', idempotency_key, user.id, id);
  }

  // Anomaly check: large withdrawal relative to the user's own average.
  const avgRow = await safeDbFirst(c.env, 'SELECT AVG(amount) as avg FROM withdrawals WHERE user_id = ? AND status != ?', user.id, 'pending');
  if (avgRow?.avg && amount > avgRow.avg * 3) {
    await safeDbRun(c.env, 'INSERT INTO admin_alerts (id, alert_type, user_id, severity, detail) VALUES (?, ?, ?, ?, ?)',
      crypto.randomUUID(), 'large_withdrawal', user.id, 'medium', `Withdrew ${amount} cents, 3x above their average`);
  }

  return c.json({ id, amount, fee: tierFee, status: 'pending', reference: withdrawalReference, message: 'Withdrawal queued. Will be processed within 24 hours.' });
});

// ── Mark withdrawal as completed (admin only) ────────────────────────────
partner.post('/withdrawal/:id/complete', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const id = c.req.param('id');
  await safeDbRun(c.env, 'UPDATE withdrawals SET status = ? WHERE id = ?', 'completed', id);
  await safeDbRun(c.env, 'INSERT INTO admin_audit_log (id, admin_id, action, target_user_id, detail) VALUES (?, ?, ?, ?, ?)',
    crypto.randomUUID(), user.id, 'force_complete_withdrawal', null, `withdrawal_id=${id}`);
  return c.json({ ok: true });
});

// ── Admin-only earnings statistics (existing) ────────────────────────────
partner.get('/stats', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
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

// ── Admin-only bulk processing of pending withdrawals (existing) ─────────
partner.post('/withdraw/auto', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  try {
    const results = await safeDbAll(c.env, "SELECT * FROM withdrawals WHERE status = 'pending'");
    if (!results.length) return c.json({ processed: 0, total_amount: 0 });
    const totalAmount = results.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    await safeDbRun(c.env, "UPDATE withdrawals SET status = 'processing' WHERE status = 'pending'");
    await safeDbRun(c.env, 'INSERT INTO admin_audit_log (id, admin_id, action, detail) VALUES (?, ?, ?, ?)',
      crypto.randomUUID(), user.id, 'bulk_process_withdrawals', `count=${results.length} total=${totalAmount}`);
    return c.json({ processed: results.length, total_amount: totalAmount });
  } catch (e) {
    console.error('PARTNER AUTO-WITHDRAW ERROR:', e.message);
    return c.json({ error: 'Failed to process withdrawals.' }, 500);
  }
});

// ── Public monthly leaderboard (existing) ────────────────────────────────
partner.get('/leaderboard', async (c) => {
  try {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    const results = await safeDbAll(
      c.env,
      `SELECT u.publisher_name as name, u.partner_tier as tier, COALESCE(SUM(r.bonus_paid), 0) as amount, COUNT(r.id) as referrals
       FROM users u
       LEFT JOIN referrals r ON r.referrer_id = u.id AND r.created_at >= ?
       WHERE u.tier IN ('partner', 'pro_partner')
       GROUP BY u.id
       ORDER BY amount DESC
       LIMIT 10`,
      since.toISOString()
    );
    return c.json({ leaders: results.map(r => ({ name: r.name || 'Anonymous', tier: r.tier || 'bronze', amount: r.amount || 0, referrals: r.referrals || 0 })) });
  } catch (e) {
    console.error('PARTNER LEADERBOARD ERROR:', e.message);
    return c.json({ leaders: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// NEW: Partner dashboard
// ═══════════════════════════════════════════════════════════════════════
partner.get('/dashboard', requireAuth, async (c) => {
  const user = c.get('user');
  const wallet = await safeDbFirst(c.env, 'SELECT * FROM wallets WHERE user_id = ?', user.id) || { balance: 0, total_earned: 0, total_withdrawn: 0 };
  const referralCount = (await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', user.id))?.count || 0;

  const [byType, monthly, recent, withdrawals, level1] = await Promise.all([
    safeDbAll(c.env, `SELECT earning_type, COALESCE(SUM(amount_kes_cents), 0) as total FROM earnings_ledger WHERE user_id = ? AND amount_kes_cents > 0 GROUP BY earning_type`, user.id),
    safeDbAll(c.env, `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(amount_kes_cents), 0) as total FROM earnings_ledger WHERE user_id = ? AND created_at >= datetime('now', '-6 months') GROUP BY month ORDER BY month`, user.id),
    safeDbAll(c.env, `SELECT earning_type, amount_kes_cents, reference_id, created_at FROM earnings_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`, user.id),
    safeDbAll(c.env, `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`, user.id),
    safeDbAll(c.env, `SELECT id, publisher_name, partner_tier, created_at FROM users WHERE referred_by = ? LIMIT 25`, user.id),
  ]);

  const breakdown = { referrals: 0, engagement: 0, recurring: 0, other: 0 };
  for (const row of byType) {
    if (row.earning_type.startsWith('referral') || row.earning_type === 'mlm_commission') breakdown.referrals += row.total;
    else if (row.earning_type.startsWith('engagement') || row.earning_type.startsWith('quality') || row.earning_type.startsWith('likes') || row.earning_type.startsWith('comments')) breakdown.engagement += row.total;
    else if (row.earning_type.startsWith('recurring')) breakdown.recurring += row.total;
    else breakdown.other += row.total;
  }

  const currentTier = user.partner_tier || 'bronze';
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  const nextTier = tierOrder[tierOrder.indexOf(currentTier) + 1] || null;
  const nextTierProgress = nextTier ? { tier: nextTier, referrals_needed: Math.max(0, TIER_CONFIG[nextTier].min - referralCount) } : null;

  return c.json({
    wallet,
    tier: currentTier,
    bonus_multiplier: TIER_CONFIG[currentTier]?.multiplier || 1.0,
    referral_count: referralCount,
    earnings_breakdown: breakdown,
    monthly_earnings: monthly,
    recent_earnings: recent,
    withdrawals,
    referral_tree_level1: level1,
    next_tier_progress: nextTierProgress,
  });
});

// ═══════════════════════════════════════════════════════════════════════
// NEW: Referral analytics
// ═══════════════════════════════════════════════════════════════════════
partner.get('/referral-stats', requireAuth, async (c) => {
  const user = c.get('user');
  const clicks = (await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM referral_clicks WHERE referrer_id = ?', user.id))?.count || 0;
  const signups = (await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', user.id))?.count || 0;
  const earned = (await safeDbFirst(c.env, `SELECT COALESCE(SUM(amount_kes_cents), 0) as total FROM earnings_ledger WHERE user_id = ? AND earning_type LIKE 'referral%'`, user.id))?.total || 0;
  return c.json({
    total_clicks: clicks,
    total_signups: signups,
    conversion_rate: clicks > 0 ? Number((signups / clicks * 100).toFixed(1)) : 0,
    earnings_from_referrals: earned,
  });
});

partner.get('/referral-tree', requireAuth, async (c) => {
  const user = c.get('user');
  const level1 = await safeDbAll(c.env, 'SELECT id, publisher_name, partner_tier, created_at FROM users WHERE referred_by = ?', user.id);

  const tree = await Promise.all(level1.map(async (l1) => {
    const earned = (await safeDbFirst(c.env, `SELECT COALESCE(SUM(amount_kes_cents), 0) as total FROM earnings_ledger WHERE reference_id = ? AND earning_type LIKE 'referral%'`, l1.id))?.total || 0;
    const level2 = await safeDbAll(c.env, 'SELECT id, publisher_name, partner_tier, created_at FROM users WHERE referred_by = ?', l1.id);
    return { ...l1, earnings_generated: earned, referrals: level2 };
  }));

  return c.json({ tree });
});

// ═══════════════════════════════════════════════════════════════════════
// NEW: Engagement earnings — cron-triggered, admin-callable
// Uses actual story table columns: view_count, likes table, comments table,
// and computes quality from word count of story body.
// ═══════════════════════════════════════════════════════════════════════
export async function checkEngagementBonuses(env) {
  const partners = await safeDbAll(env, "SELECT id FROM users WHERE tier IN ('partner', 'pro_partner')");
  let awarded = 0;

  for (const p of partners) {
    const stories = await safeDbAll(env, 'SELECT id, author_id, view_count, body FROM stories WHERE author_id = ? AND deleted = 0', p.id);
    for (const story of stories) {
      const viewCount = story.view_count || 0;

      // Get actual likes count from likes table
      const likesRow = await safeDbFirst(env, 'SELECT COUNT(*) as count FROM likes WHERE story_id = ?', story.id);
      const likeCount = likesRow?.count || 0;

      // Get actual comments count from comments table
      const commentsRow = await safeDbFirst(env, 'SELECT COUNT(*) as count FROM comments WHERE story_id = ?', story.id);
      const commentCount = commentsRow?.count || 0;

      // Compute quality score from word count of body
      const bodyText = String(story.body || '').replace(/<[^>]*>/g, ' ');
      const words = bodyText.match(/[A-Za-z'-]+/g) || [];
      const wordCount = words.length;
      let qualityScore = null;
      if (wordCount >= 800) qualityScore = 'gold';
      else if (wordCount >= 400) qualityScore = 'silver';

      const candidates = [];
      if (viewCount >= 1000) candidates.push(['views_1000', ENGAGEMENT_BONUS_1000]);
      else if (viewCount >= 500) candidates.push(['views_500', ENGAGEMENT_BONUS_500]);
      else if (viewCount >= 100) candidates.push(['views_100', ENGAGEMENT_BONUS_100]);
      else if (viewCount >= 50) candidates.push(['views_50', ENGAGEMENT_BONUS_50]);

      if (qualityScore === 'gold') candidates.push(['quality_gold', QUALITY_BONUS_GOLD]);
      else if (qualityScore === 'silver') candidates.push(['quality_silver', QUALITY_BONUS_SILVER]);

      if (likeCount >= 50) candidates.push(['likes_50', LIKES_BONUS_50]);
      if (commentCount >= 20) candidates.push(['comments_20', COMMENTS_BONUS_20]);

      for (const [milestone, amount] of candidates) {
        const result = await safeDbRun(
          env,
          'INSERT INTO engagement_earnings (id, user_id, story_id, milestone, amount_kes_cents) VALUES (?, ?, ?, ?, ?)',
          crypto.randomUUID(), p.id, story.id, milestone, amount
        );
        // UNIQUE(story_id, milestone) constraint prevents double-pay
        if (!result || (result.meta?.changes ?? result.changes ?? 0) === 0) continue;

        await creditWallet(env, {
          userId: p.id,
          earningType: milestone.startsWith('views') ? `engagement_${milestone.split('_')[1]}` : milestone,
          amountCents: amount,
          referenceId: story.id,
          platformFeeRate: PLATFORM_FEE_ENGAGEMENT,
          note: `Milestone: ${milestone}`,
        });
        awarded++;
      }
    }
  }
  return { awarded };
}

partner.post('/check-engagement', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const result = await checkEngagementBonuses(c.env);
  return c.json(result);
});

// ═══════════════════════════════════════════════════════════════════════
// NEW: Tier management
// ═══════════════════════════════════════════════════════════════════════
partner.get('/tier', requireAuth, async (c) => {
  const user = c.get('user');
  const referralCount = (await safeDbFirst(c.env, 'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', user.id))?.count || 0;
  const currentTier = tierForReferralCount(referralCount);
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  const nextTier = tierOrder[tierOrder.indexOf(currentTier) + 1] || null;

  return c.json({
    tier: currentTier,
    bonus_multiplier: TIER_CONFIG[currentTier].multiplier,
    withdrawal_fee: TIER_CONFIG[currentTier].fee,
    referral_count: referralCount,
    next_tier: nextTier ? { name: nextTier, referrals_required: TIER_CONFIG[nextTier].min, referrals_needed: Math.max(0, TIER_CONFIG[nextTier].min - referralCount) } : null,
    all_tiers: TIER_CONFIG,
  });
});

export async function recalculateAllTiers(env) {
  const users = await safeDbAll(env, "SELECT id FROM users WHERE tier IN ('partner', 'pro_partner')");
  let updated = 0;
  for (const u of users) {
    const count = (await safeDbFirst(env, 'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', u.id))?.count || 0;
    const tier = tierForReferralCount(count);
    await safeDbRun(env, "UPDATE users SET partner_tier = ?, partner_bonus_multiplier = ?, partner_tier_updated_at = datetime('now') WHERE id = ?",
      tier, TIER_CONFIG[tier].multiplier, u.id);
    updated++;
  }
  return { updated };
}

partner.post('/tier/recalculate', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const result = await recalculateAllTiers(c.env);
  return c.json(result);
});

// ═══════════════════════════════════════════════════════════════════════
// NEW: Anomaly detection (cron)
// ═══════════════════════════════════════════════════════════════════════
export async function runAnomalyDetection(env) {
  let flagged = 0;
  // 3+ referrals from the same IP in the last 7 days.
  const clusters = await safeDbAll(
    env,
    `SELECT referrer_id, ip_address, COUNT(*) as count FROM referral_clicks
     WHERE converted = 1 AND created_at >= datetime('now', '-7 days')
     GROUP BY referrer_id, ip_address HAVING count >= 3`
  );
  for (const row of clusters) {
    await safeDbRun(env, 'INSERT INTO admin_alerts (id, alert_type, user_id, severity, detail) VALUES (?, ?, ?, ?, ?)',
      crypto.randomUUID(), 'same_ip_referrals', row.referrer_id, 'high', `${row.count} converted referrals from IP ${row.ip_address}`);
    flagged++;
  }
  return { flagged };
}

// ═══════════════════════════════════════════════════════════════════════
// NEW: Admin god endpoints
// All financial admin actions require an X-Admin-Pin header, verified via
// constant-time comparison against env.ADMIN_PIN_HASH (SHA-256 hex).
// ═══════════════════════════════════════════════════════════════════════
async function verifyAdminPin(c) {
  const pin = c.req.header('X-Admin-Pin');
  const expectedHash = c.env.ADMIN_PIN_HASH;
  if (!pin || !expectedHash) return false;
  const enc = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

async function requireAdminPin(c) {
  const user = c.get('user');
  if (!isAdmin(user)) return { error: c.json({ error: 'Unauthorized.' }, 403) };
  if (!(await verifyAdminPin(c))) return { error: c.json({ error: 'Invalid or missing admin PIN.' }, 403) };
  return { user };
}

async function auditLog(env, adminId, action, targetUserId, detail) {
  await safeDbRun(env, 'INSERT INTO admin_audit_log (id, admin_id, action, target_user_id, detail) VALUES (?, ?, ?, ?, ?)',
    crypto.randomUUID(), adminId, action, targetUserId, detail);
}

partner.post('/admin/freeze-wallet', requireAuth, async (c) => {
  const { user, error } = await requireAdminPin(c);
  if (error) return error;
  const { user_id, reason } = await c.req.json().catch(() => ({}));
  if (!user_id || !reason) return c.json({ error: 'user_id and reason are required.' }, 400);
  await safeDbRun(c.env, 'UPDATE wallets SET is_frozen = 1, frozen_reason = ?, frozen_by = ? WHERE user_id = ?', reason, user.id, user_id);
  await auditLog(c.env, user.id, 'freeze_wallet', user_id, reason);
  return c.json({ ok: true });
});

partner.post('/admin/unfreeze-wallet', requireAuth, async (c) => {
  const { user, error } = await requireAdminPin(c);
  if (error) return error;
  const { user_id } = await c.req.json().catch(() => ({}));
  if (!user_id) return c.json({ error: 'user_id is required.' }, 400);
  await safeDbRun(c.env, 'UPDATE wallets SET is_frozen = 0, frozen_reason = NULL, frozen_by = NULL WHERE user_id = ?', user_id);
  await auditLog(c.env, user.id, 'unfreeze_wallet', user_id, null);
  return c.json({ ok: true });
});

partner.post('/admin/adjust-balance', requireAuth, async (c) => {
  const { user, error } = await requireAdminPin(c);
  if (error) return error;
  const { user_id, amount_kes_cents, reason } = await c.req.json().catch(() => ({}));
  if (!user_id || !amount_kes_cents || !reason) return c.json({ error: 'user_id, amount_kes_cents, and reason are required.' }, 400);

  if (amount_kes_cents > 0) {
    const result = await creditWallet(c.env, { userId: user_id, earningType: 'admin_adjustment', amountCents: amount_kes_cents, note: reason, createdBy: user.id });
    if (!result.ok) return c.json({ error: result.error }, 400);
  } else {
    // Negative adjustment — debit with the same optimistic-locking pattern as withdrawals.
    let ok = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const wallet = await safeDbFirst(c.env, 'SELECT * FROM wallets WHERE user_id = ?', user_id);
      if (!wallet) return c.json({ error: 'Wallet not found.' }, 404);
      const version = wallet.version || 0;
      const result = await safeDbRun(c.env, 'UPDATE wallets SET balance = MAX(0, balance + ?), version = ? WHERE user_id = ? AND version = ?',
        amount_kes_cents, version + 1, user_id, version);
      if (result && result.meta?.changes === 1) { ok = true; break; }
    }
    if (!ok) return c.json({ error: 'Could not adjust balance — please retry.' }, 409);
    await safeDbRun(c.env, 'INSERT INTO earnings_ledger (id, user_id, earning_type, amount_kes_cents, running_balance, note, created_by) VALUES (?, ?, ?, ?, (SELECT balance FROM wallets WHERE user_id = ?), ?, ?)',
      crypto.randomUUID(), user_id, 'admin_adjustment', amount_kes_cents, user_id, reason, user.id);
  }
  await auditLog(c.env, user.id, 'adjust_balance', user_id, `${amount_kes_cents} cents: ${reason}`);
  return c.json({ ok: true });
});

partner.post('/admin/ban-partner', requireAuth, async (c) => {
  const { user, error } = await requireAdminPin(c);
  if (error) return error;
  const { user_id, reason } = await c.req.json().catch(() => ({}));
  if (!user_id || !reason) return c.json({ error: 'user_id and reason are required.' }, 400);
  await safeDbRun(c.env, "UPDATE users SET partner_tier = 'banned', referral_code = NULL WHERE id = ?", user_id);
  await safeDbRun(c.env, 'UPDATE wallets SET is_frozen = 1, frozen_reason = ?, frozen_by = ? WHERE user_id = ?', `Banned: ${reason}`, user.id, user_id);
  await auditLog(c.env, user.id, 'ban_partner', user_id, reason);
  return c.json({ ok: true });
});

partner.post('/admin/unban-partner', requireAuth, async (c) => {
  const { user, error } = await requireAdminPin(c);
  if (error) return error;
  const { user_id } = await c.req.json().catch(() => ({}));
  if (!user_id) return c.json({ error: 'user_id is required.' }, 400);
  await safeDbRun(c.env, "UPDATE users SET partner_tier = 'bronze' WHERE id = ? AND partner_tier = 'banned'", user_id);
  await safeDbRun(c.env, 'UPDATE wallets SET is_frozen = 0, frozen_reason = NULL, frozen_by = NULL WHERE user_id = ?', user_id);
  await auditLog(c.env, user.id, 'unban_partner', user_id, null);
  return c.json({ ok: true });
});

partner.get('/admin/ledger/:userId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const userId = c.req.param('userId');
  const entries = await safeDbAll(c.env, 'SELECT * FROM earnings_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', userId);
  return c.json({ entries });
});

partner.get('/admin/alerts', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const resolved = c.req.query('resolved') === 'true' ? 1 : 0;
  const alerts = await safeDbAll(c.env, 'SELECT * FROM admin_alerts WHERE is_resolved = ? ORDER BY created_at DESC LIMIT 100', resolved);
  return c.json({ alerts });
});

partner.post('/admin/alerts/:id/resolve', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const id = c.req.param('id');
  await safeDbRun(c.env, "UPDATE admin_alerts SET is_resolved = 1, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?", user.id, id);
  return c.json({ ok: true });
});

partner.get('/admin/revenue', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized.' }, 403);
  const [total, bySource, monthly] = await Promise.all([
    safeDbFirst(c.env, 'SELECT COALESCE(SUM(amount_kes_cents), 0) as total FROM platform_revenue'),
    safeDbAll(c.env, 'SELECT source, COALESCE(SUM(amount_kes_cents), 0) as total FROM platform_revenue GROUP BY source'),
    safeDbAll(c.env, `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(amount_kes_cents), 0) as total FROM platform_revenue WHERE created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month`),
  ]);
  return c.json({ total_kes_cents: total?.total || 0, by_source: bySource, by_month: monthly });
});

export default partner;