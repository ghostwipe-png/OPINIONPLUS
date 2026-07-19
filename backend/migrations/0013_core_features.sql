-- Migration 0011: Core Features Goddess Upgrade
-- Additive only — safe to run against an existing production database.
-- Uses IF NOT EXISTS / defensive patterns wherever the SQLite/D1 dialect allows it.

-- Featured stories
ALTER TABLE stories ADD COLUMN featured INTEGER DEFAULT 0;
ALTER TABLE stories ADD COLUMN featured_at TEXT;

-- Scheduled publishing
ALTER TABLE stories ADD COLUMN scheduled_at TEXT;

-- Reading stats
ALTER TABLE stories ADD COLUMN view_count INTEGER DEFAULT 0;

-- Bulk archive support (used by POST /bulk-archive)
ALTER TABLE stories ADD COLUMN archived INTEGER DEFAULT 0;

-- View tracking — one row per story/ip/day for unique-view counting
CREATE TABLE IF NOT EXISTS story_views (
  story_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (story_id, ip, viewed_at)
);
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views (story_id);

-- Comment reactions
CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions (comment_id);

-- Pinned comments (one per story)
ALTER TABLE comments ADD COLUMN pinned INTEGER DEFAULT 0;

-- Soft-deleted / moderated comments
ALTER TABLE comments ADD COLUMN removed INTEGER DEFAULT 0;
