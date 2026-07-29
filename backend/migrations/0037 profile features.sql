-- User Badges / Achievements
CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_type TEXT NOT NULL,  -- top_writer, milestone_stories, verified_publisher, early_adopter, partner_tier
  badge_label TEXT NOT NULL,
  badge_icon TEXT,  -- optional lucide icon name
  category TEXT,    -- for top_writer: which category
  awarded_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- Pinned / Featured Stories
CREATE TABLE IF NOT EXISTS pinned_stories (
  user_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  pinned_at TEXT DEFAULT (datetime('now'))
);

-- Profile Customization (cover image)
ALTER TABLE users ADD COLUMN cover_image TEXT;

-- User Endorsements
CREATE TABLE IF NOT EXISTS user_endorsements (
  id TEXT PRIMARY KEY,
  endorser_id TEXT NOT NULL,
  endorsed_user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(endorser_id, endorsed_user_id, topic)
);
CREATE INDEX IF NOT EXISTS idx_endorsements_endorsed ON user_endorsements(endorsed_user_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_endorser ON user_endorsements(endorser_id);