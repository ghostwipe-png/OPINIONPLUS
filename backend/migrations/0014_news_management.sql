-- News management settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default: news aggregation is ON
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('news_enabled', 'true');