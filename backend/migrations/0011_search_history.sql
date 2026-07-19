CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  user_id TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);