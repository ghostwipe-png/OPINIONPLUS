-- Campus logos (separate from users table)
CREATE TABLE IF NOT EXISTS campus_logos (
  campus_id TEXT PRIMARY KEY,
  logo_url TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Student journalists under a campus
CREATE TABLE IF NOT EXISTS campus_students (
  campus_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'journalist',
  status TEXT DEFAULT 'active',
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (campus_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_campus_students_user ON campus_students(user_id);

-- Campus subscriptions (users following a campus)
CREATE TABLE IF NOT EXISTS campus_subscriptions (
  campus_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  notify_email INTEGER DEFAULT 0,
  notify_push INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (campus_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_campus_subs_campus ON campus_subscriptions(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_subs_user ON campus_subscriptions(user_id);

-- Campus events
CREATE TABLE IF NOT EXISTS campus_events (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date TEXT NOT NULL,
  location TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  image_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campus_events_campus ON campus_events(campus_id);

-- Campus polls
CREATE TABLE IF NOT EXISTS campus_polls (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  ends_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campus_polls_campus ON campus_polls(campus_id);

-- Campus poll votes
CREATE TABLE IF NOT EXISTS campus_poll_votes (
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (poll_id, user_id)
);

-- Campus categories/departments
CREATE TABLE IF NOT EXISTS campus_categories (
  campus_id TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (campus_id, category)
);

-- Campus stats cache
CREATE TABLE IF NOT EXISTS campus_stats (
  campus_id TEXT PRIMARY KEY,
  total_stories INTEGER DEFAULT 0,
  total_students INTEGER DEFAULT 0,
  total_subscribers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Add campus_id to stories table
ALTER TABLE stories ADD COLUMN campus_id TEXT;
CREATE INDEX IF NOT EXISTS idx_stories_campus ON stories(campus_id);