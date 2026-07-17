CREATE TABLE IF NOT EXISTS collaborations (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  co_author_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (co_author_id) REFERENCES users(id)
);