-- backend/migrations/0038_platform_hardening.sql
-- Platform Hardening: Feature Flags, IP Blacklist, Circuit Breakers, Monitoring
-- Safe to run multiple times — all IF NOT EXISTS

-- Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  flag_value TEXT NOT NULL DEFAULT 'true',
  description TEXT,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO feature_flags (flag_key, flag_value, description) VALUES ('maintenance_mode', 'false', 'Show maintenance page to non-admin users');
INSERT OR IGNORE INTO feature_flags (flag_key, flag_value, description) VALUES ('disable_signups', 'false', 'Prevent new user registrations');
INSERT OR IGNORE INTO feature_flags (flag_key, flag_value, description) VALUES ('disable_comments', 'false', 'Disable commenting site-wide');
INSERT OR IGNORE INTO feature_flags (flag_key, flag_value, description) VALUES ('disable_story_creation', 'false', 'Prevent new story publishing');
INSERT OR IGNORE INTO feature_flags (flag_key, flag_value, description) VALUES ('beta_features', '{}', 'JSON map of user_id -> beta features');

-- IP Blacklist
CREATE TABLE IF NOT EXISTS ip_blacklist (
  ip_address TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  blocked_at TEXT DEFAULT (datetime('now')),
  blocked_until TEXT,
  violation_count INTEGER DEFAULT 1,
  is_permanent INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_until ON ip_blacklist(blocked_until);

-- Circuit Breaker State
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  service_name TEXT PRIMARY KEY,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TEXT,
  state TEXT DEFAULT 'closed',
  opened_at TEXT,
  last_success_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO circuit_breaker_state (service_name, state) VALUES ('paystack', 'closed');
INSERT OR IGNORE INTO circuit_breaker_state (service_name, state) VALUES ('bunny_stream', 'closed');
INSERT OR IGNORE INTO circuit_breaker_state (service_name, state) VALUES ('google_oauth', 'closed');

-- Slow Query Log
CREATE TABLE IF NOT EXISTS slow_query_log (
  id TEXT PRIMARY KEY,
  query_snippet TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  endpoint TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_slow_query_created ON slow_query_log(created_at);

-- Cron Job Log
CREATE TABLE IF NOT EXISTS cron_job_log (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cron_job_name ON cron_job_log(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_created ON cron_job_log(created_at);

-- Dead Links
CREATE TABLE IF NOT EXISTS dead_links (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  link_url TEXT NOT NULL,
  status_code INTEGER,
  found_at TEXT DEFAULT (datetime('now')),
  resolved INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dead_links_story ON dead_links(story_id);

-- Content Filter Log
CREATE TABLE IF NOT EXISTS content_filter_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  content_type TEXT NOT NULL,
  content_snippet TEXT,
  filter_trigger TEXT,
  action_taken TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Error Aggregation
CREATE TABLE IF NOT EXISTS error_aggregation (
  error_key TEXT PRIMARY KEY,
  error_message TEXT NOT NULL,
  endpoint TEXT,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  occurrence_count INTEGER DEFAULT 1,
  resolved INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_error_agg_count ON error_aggregation(occurrence_count DESC);