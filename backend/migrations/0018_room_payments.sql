CREATE TABLE IF NOT EXISTS room_payments (
  reference TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);