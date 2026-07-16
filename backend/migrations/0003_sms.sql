CREATE TABLE IF NOT EXISTS sms_credits (
  user_id TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 5,
  total_sent INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sms_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sms_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  recipients TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sent',
  sender_id TEXT DEFAULT 'OPINIONPLUS',
  cost INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);