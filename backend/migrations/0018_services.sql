-- backend/migrations/0018_services.sql
-- Service purchases / orders
CREATE TABLE IF NOT EXISTS service_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  service_type TEXT NOT NULL,  -- 'sms', 'press_release', 'sponsored', 'api'
  package_id TEXT NOT NULL,     -- e.g., 'sms_100', 'press_release_basic'
  amount_paid INTEGER NOT NULL, -- in cents (KES)
  paystack_reference TEXT NOT NULL UNIQUE,
  paystack_status TEXT DEFAULT 'pending', -- pending, success, failed, refunded
  metadata TEXT DEFAULT '{}',   -- JSON: extra service-specific data
  status TEXT DEFAULT 'pending', -- pending, active, completed, cancelled
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_service_orders_user ON service_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_ref ON service_orders (paystack_reference);

-- SMS credit packages
CREATE TABLE IF NOT EXISTS sms_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sms_count INTEGER NOT NULL,
  price_kes_cents INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed SMS packages
INSERT OR IGNORE INTO sms_packages (id, name, sms_count, price_kes_cents) VALUES
  ('sms_100', '100 SMS', 100, 5000),
  ('sms_500', '500 SMS', 500, 20000),
  ('sms_1000', '1,000 SMS', 1000, 35000),
  ('sms_5000', '5,000 SMS', 5000, 150000),
  ('sms_10000', '10,000 SMS', 10000, 250000);

-- Press release packages
CREATE TABLE IF NOT EXISTS press_release_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  features TEXT NOT NULL,  -- JSON array of features
  price_kes_cents INTEGER NOT NULL,
  duration_days INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO press_release_packages (id, name, features, price_kes_cents) VALUES
  ('press_basic', 'Basic', '["Published on OpinionPlus","Appears in feed for 30 days","Press Release tag","Basic analytics"]', 100000),
  ('press_pro', 'Professional', '["Published on OpinionPlus","Appears in feed for 30 days","Press Release tag","Featured placement","SMS blast to 100 subscribers","Detailed analytics report","Social media sharing"]', 300000),
  ('press_enterprise', 'Enterprise', '["Published on OpinionPlus","Appears in feed for 30 days","Press Release tag","Top featured placement","SMS blast to 500 subscribers","Detailed analytics report","Social media sharing","Dedicated account manager","Priority support"]', 750000);

-- Sponsored content packages
CREATE TABLE IF NOT EXISTS sponsored_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  impressions_goal INTEGER DEFAULT 0,
  price_kes_cents INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO sponsored_packages (id, name, duration_days, impressions_goal, price_kes_cents) VALUES
  ('sponsored_7', '7-Day Promotion', 7, 1000, 100000),
  ('sponsored_14', '14-Day Promotion', 14, 2500, 200000),
  ('sponsored_30', '30-Day Promotion', 30, 5000, 400000);

-- API access packages
CREATE TABLE IF NOT EXISTS api_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  requests_per_day INTEGER NOT NULL,
  price_kes_cents INTEGER NOT NULL,
  features TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO api_packages (id, name, requests_per_day, price_kes_cents, features) VALUES
  ('api_free', 'Free', 100, 0, '["100 requests/day","REST API","JSON responses","Community support"]'),
  ('api_pro', 'Pro', 10000, 300000, '["10,000 requests/day","REST API","JSON + RSS","Email support","99.9% uptime SLA"]'),
  ('api_enterprise', 'Enterprise', 100000, 1000000, '["100,000 requests/day","REST API","JSON + RSS + Webhooks","Priority support","Dedicated account manager","Custom integrations","99.99% uptime SLA"]');

-- API keys tracking
ALTER TABLE api_keys ADD COLUMN tier TEXT DEFAULT 'free';
ALTER TABLE api_keys ADD COLUMN requests_today INTEGER DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN last_reset_date TEXT;