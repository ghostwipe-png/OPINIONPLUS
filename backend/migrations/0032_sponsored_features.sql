-- Sponsored Campaigns — Core table
CREATE TABLE IF NOT EXISTS sponsored_campaigns (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  user_id TEXT NOT NULL,
  user_email TEXT,
  package_id TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  banner_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, scheduled, active, paused, completed, cancelled
  scheduled_start_at TEXT,
  started_at TEXT,
  paused_at TEXT,
  ends_at TEXT,
  duration_days INTEGER NOT NULL DEFAULT 7,
  impressions_goal INTEGER DEFAULT 0,
  impressions_served INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  budget_kes_cents INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  expiry_notified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsored_campaigns_user ON sponsored_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_campaigns_status ON sponsored_campaigns(status);

-- Sponsored Creatives — Multiple ads per campaign (A/B testing)
CREATE TABLE IF NOT EXISTS sponsored_creatives (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  cta_url TEXT,
  banner_url TEXT,
  is_control INTEGER DEFAULT 0,  -- 1 = control creative
  impressions_served INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsored_creatives_campaign ON sponsored_creatives(campaign_id);

-- Sponsored Analytics — Daily breakdown per campaign
CREATE TABLE IF NOT EXISTS sponsored_analytics_daily (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  spend_kes_cents INTEGER DEFAULT 0,
  UNIQUE(campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_sponsored_analytics_campaign ON sponsored_analytics_daily(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_analytics_date ON sponsored_analytics_daily(date);

-- Sponsored Conversions — Pixel tracking
CREATE TABLE IF NOT EXISTS sponsored_conversions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  conversion_type TEXT DEFAULT 'page_view',  -- page_view, signup, purchase, custom
  value_kes_cents INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsored_conversions_campaign ON sponsored_conversions(campaign_id);

-- Sponsored Targeting — Per-campaign targeting rules
CREATE TABLE IF NOT EXISTS sponsored_targeting (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  target_type TEXT NOT NULL,  -- category, region, county
  target_value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsored_targeting_campaign ON sponsored_targeting(campaign_id);

-- Sponsored Geo Analytics — Geographic breakdown
CREATE TABLE IF NOT EXISTS sponsored_geo_analytics (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  date TEXT NOT NULL,
  region TEXT,
  county TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  UNIQUE(campaign_id, date, region, county)
);
CREATE INDEX IF NOT EXISTS idx_sponsored_geo_campaign ON sponsored_geo_analytics(campaign_id);
