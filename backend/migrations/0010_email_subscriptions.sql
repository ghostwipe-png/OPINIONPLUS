CREATE TABLE IF NOT EXISTS email_subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  preferences TEXT DEFAULT 'all',
  status TEXT DEFAULT 'active',
  confirmed INTEGER DEFAULT 0,
  confirm_token TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_sent_at TEXT
);