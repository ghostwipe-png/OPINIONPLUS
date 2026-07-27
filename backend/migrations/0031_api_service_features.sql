-- 0031_api_service_features.sql
-- Standalone API Service — Complete Feature Set
-- Extends existing api_keys table + creates new supporting tables
-- Nothing here alters or removes existing tables/columns

-- ---------------------------------------------------------------------------
-- Extend existing api_keys table with new columns
-- ---------------------------------------------------------------------------
ALTER TABLE api_keys ADD COLUMN key_name TEXT DEFAULT 'Default Key';
ALTER TABLE api_keys ADD COLUMN key_type TEXT DEFAULT 'production';
ALTER TABLE api_keys ADD COLUMN scopes TEXT DEFAULT '["stories:read","press_release:read","sponsored:read","analytics:read"]';
ALTER TABLE api_keys ADD COLUMN last_used_at TEXT;
ALTER TABLE api_keys ADD COLUMN expires_at TEXT;
ALTER TABLE api_keys ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE api_keys ADD COLUMN created_by_ip TEXT;

-- ---------------------------------------------------------------------------
-- API Request Logs — every authenticated API call logged here
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_request_logs (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  request_body_size INTEGER DEFAULT 0,
  response_body_size INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_request_logs(created_at);

-- ---------------------------------------------------------------------------
-- API Usage Daily — aggregated per key per day
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_usage_daily (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  calls_count INTEGER DEFAULT 0,
  bandwidth_bytes INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms REAL DEFAULT 0,
  UNIQUE(api_key_id, date)
);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_date ON api_usage_daily(api_key_id, date);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_daily(user_id);

-- ---------------------------------------------------------------------------
-- Webhook Configurations — per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  webhook_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT DEFAULT '["story.published","press_release.published"]',
  secret TEXT,
  is_active INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON api_webhooks(user_id);

-- ---------------------------------------------------------------------------
-- Webhook Delivery Logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_webhook_logs (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  success INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON api_webhook_logs(webhook_id);

-- ---------------------------------------------------------------------------
-- IP Whitelist — per API key
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_ip_whitelist (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  cidr_range TEXT,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_key ON api_ip_whitelist(api_key_id);

-- ---------------------------------------------------------------------------
-- OAuth Applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_oauth_apps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_description TEXT,
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT DEFAULT '[]',
  scopes TEXT DEFAULT '["stories:read"]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oauth_apps_user ON api_oauth_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_apps_client ON api_oauth_apps(client_id);

-- ---------------------------------------------------------------------------
-- Usage Alerts Configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_usage_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  threshold_percent INTEGER NOT NULL,
  destination TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON api_usage_alerts(user_id);