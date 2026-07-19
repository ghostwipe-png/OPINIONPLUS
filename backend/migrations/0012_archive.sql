CREATE TABLE IF NOT EXISTS archive (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  cover_image TEXT,
  type TEXT DEFAULT 'news',
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  feed_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_archive_status ON archive(status);
CREATE INDEX IF NOT EXISTS idx_archive_source ON archive(source_name);