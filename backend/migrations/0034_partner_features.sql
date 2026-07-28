-- 0034_partner_features.sql
-- Partner/Referral platform: ledger, tiers, revenue tracking, anti-fraud, alerts.
-- Safe to run multiple times: uses IF NOT EXISTS / guarded ALTER TABLE where D1 allows it.

-- Earnings Ledger — Immutable, append-only record of every earning event.
-- Never UPDATE this table. Corrections are new rows with negative amounts.
CREATE TABLE IF NOT EXISTS earnings_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  earning_type TEXT NOT NULL,       -- referral_basic, referral_partner, referral_pro, mlm_commission,
                                     -- engagement_50, engagement_100, engagement_500, engagement_1000,
                                     -- quality_gold, quality_silver, likes_50, comments_20,
                                     -- recurring_sms, recurring_press, recurring_sponsored, admin_adjustment, reversal
  amount_kes_cents INTEGER NOT NULL,
  reference_id TEXT,                -- referral_id, story_id, order_id, ledger_id being reversed
  running_balance INTEGER NOT NULL,
  platform_fee_kes_cents INTEGER DEFAULT 0,
  note TEXT,
  created_by TEXT,                  -- admin user id, if this was an admin-triggered entry
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_user ON earnings_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_type ON earnings_ledger(earning_type);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_created ON earnings_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_reference ON earnings_ledger(reference_id);

-- Referral Clicks — Track link clicks for conversion analytics.
CREATE TABLE IF NOT EXISTS referral_clicks (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  converted INTEGER DEFAULT 0,      -- 1 if this click led to a signup
  converted_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer ON referral_clicks(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_created ON referral_clicks(created_at);

-- Platform Revenue Tracking
CREATE TABLE IF NOT EXISTS platform_revenue (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,             -- referral_fee, engagement_fee, recurring_fee, withdrawal_fee
  amount_kes_cents INTEGER NOT NULL,
  reference_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_source ON platform_revenue(source);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_created ON platform_revenue(created_at);

-- Admin Alerts (anomaly detection)
CREATE TABLE IF NOT EXISTS admin_alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,         -- high_earnings, same_ip_referrals, large_withdrawal, suspended_user_earning
  user_id TEXT,
  severity TEXT DEFAULT 'low',      -- low, medium, high, critical
  detail TEXT,
  is_resolved INTEGER DEFAULT 0,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON admin_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_resolved ON admin_alerts(is_resolved);

-- Admin audit log — every god-mode action, immutable.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,             -- freeze_wallet, unfreeze_wallet, adjust_balance, ban_partner, unban_partner, force_complete_withdrawal, cancel_withdrawal
  target_user_id TEXT,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);

-- Engagement Earnings — one row per (story, milestone) so bonuses can never double-pay.
CREATE TABLE IF NOT EXISTS engagement_earnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  milestone TEXT NOT NULL,          -- views_50, views_100, views_500, views_1000, quality_gold, quality_silver, likes_50, comments_20
  amount_kes_cents INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(story_id, milestone)
);
CREATE INDEX IF NOT EXISTS idx_engagement_earnings_user ON engagement_earnings(user_id);

-- Withdrawal idempotency — one row per client-supplied idempotency key per user.
CREATE TABLE IF NOT EXISTS withdrawal_idempotency (
  idempotency_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  withdrawal_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (idempotency_key, user_id)
);

-- users / wallets column additions.
-- D1 (SQLite) has no "ADD COLUMN IF NOT EXISTS"; wrap each in its own migration
-- step and ignore "duplicate column name" errors when re-running.
ALTER TABLE users ADD COLUMN partner_tier TEXT DEFAULT 'bronze';
ALTER TABLE users ADD COLUMN partner_bonus_multiplier REAL DEFAULT 1.0;
ALTER TABLE users ADD COLUMN partner_tier_updated_at TEXT;
ALTER TABLE users ADD COLUMN referral_ip TEXT;
ALTER TABLE users ADD COLUMN device_fingerprint TEXT;

ALTER TABLE wallets ADD COLUMN version INTEGER DEFAULT 0;
ALTER TABLE wallets ADD COLUMN is_frozen INTEGER DEFAULT 0;
ALTER TABLE wallets ADD COLUMN frozen_reason TEXT;
ALTER TABLE wallets ADD COLUMN frozen_by TEXT;
ALTER TABLE wallets ADD COLUMN total_earned INTEGER DEFAULT 0;
ALTER TABLE wallets ADD COLUMN total_withdrawn INTEGER DEFAULT 0;

ALTER TABLE referrals ADD COLUMN bonus_paid INTEGER DEFAULT 0;
ALTER TABLE referrals ADD COLUMN bonus_type TEXT;
