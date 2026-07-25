CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  bunny_video_id TEXT NOT NULL UNIQUE,
  bunny_library_id TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1920,
  height INTEGER DEFAULT 1080,
  status TEXT DEFAULT 'processing',  -- processing, ready, failed, deleted
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  category TEXT DEFAULT 'general',   -- news, documentary, entertainment, educational
  privacy TEXT DEFAULT 'public',     -- public, unlisted, private
  views INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_bunny ON videos(bunny_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);