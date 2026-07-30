-- backend/migrations/0039_global_services.sql
-- Global Services: Translation, AI, Audio, Breaking News Alerts, Language Preferences
-- Safe to run multiple times — all IF NOT EXISTS

-- Translations Cache — store translated content to avoid re-translating
CREATE TABLE IF NOT EXISTS translations_cache (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,  -- 'story', 'comment', 'bio', 'headline'
  source_id TEXT NOT NULL,
  source_text_hash TEXT NOT NULL,  -- SHA-256 of original text (detect edits)
  source_language TEXT NOT NULL,   -- auto-detected language code
  target_language TEXT NOT NULL,   -- target language code
  translated_text TEXT NOT NULL,
  character_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations_cache(source_type, source_id, target_language);
CREATE INDEX IF NOT EXISTS idx_translations_hash ON translations_cache(source_text_hash, target_language);

-- Audio Cache — store generated TTS audio URLs
CREATE TABLE IF NOT EXISTS audio_cache (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL UNIQUE,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  language TEXT DEFAULT 'en',
  voice_id TEXT DEFAULT 'en-US-News-K',  -- Google Cloud TTS voice
  character_count INTEGER DEFAULT 0,
  generated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audio_cache_story ON audio_cache(story_id);

-- AI Summaries — store AI-generated summaries
CREATE TABLE IF NOT EXISTS ai_summaries (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL UNIQUE,
  summary_json TEXT NOT NULL,  -- JSON: { bullets: [], key_takeaway: "", sentiment: "" }
  model TEXT DEFAULT 'gemini-pro',
  generated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_story ON ai_summaries(story_id);

-- User Language Preferences
ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN preferred_ui_language TEXT DEFAULT 'en';

-- Breaking News Alert Subscriptions
CREATE TABLE IF NOT EXISTS breaking_news_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'push',  -- 'push', 'email', 'sms'
  topics TEXT DEFAULT '[]',  -- JSON array of topic keywords
  regions TEXT DEFAULT '[]',  -- JSON array of regions
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_breaking_alerts_user ON breaking_news_alerts(user_id);

-- Breaking News Alert History
CREATE TABLE IF NOT EXISTS breaking_alert_history (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  recipients_count INTEGER DEFAULT 0,
  sent_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alert_history_story ON breaking_alert_history(story_id);