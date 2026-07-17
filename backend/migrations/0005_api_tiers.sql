CREATE TABLE IF NOT EXISTS api_usage (
  user_id TEXT PRIMARY KEY,
  calls_today INTEGER DEFAULT 0,
  date TEXT DEFAULT (date('now')),
  tier TEXT DEFAULT 'free',
  subscription_active INTEGER DEFAULT 0,
  plan_code TEXT,
  subscription_code TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);