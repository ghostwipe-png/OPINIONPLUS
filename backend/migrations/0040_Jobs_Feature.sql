-- Migration 0040: Jobs Board Feature Upgrade
-- Adds: application tracking, job alerts, saved jobs, featured jobs,
-- salary range, remote flag, categories, view counts, employer profiles.
-- Safe to run once. All new tables use IF NOT EXISTS; ALTER TABLE
-- statements are one-time (D1/SQLite migrations run exactly once).

-- Job Applications Tracking
CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_created ON job_applications(created_at);

-- Job Alerts Subscriptions
CREATE TABLE IF NOT EXISTS job_alerts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  job_types TEXT DEFAULT '["Full-time"]',
  frequency TEXT DEFAULT 'weekly',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_alerts_email ON job_alerts(email);

-- Saved Jobs (Bookmarks)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job ON saved_jobs(job_id);

-- Featured Jobs + Salary + Remote + Category + Views
ALTER TABLE jobs ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN featured_until TEXT;
ALTER TABLE jobs ADD COLUMN salary_min INTEGER;
ALTER TABLE jobs ADD COLUMN salary_max INTEGER;
ALTER TABLE jobs ADD COLUMN is_remote INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN category TEXT DEFAULT 'Media & Journalism';
ALTER TABLE jobs ADD COLUMN view_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_featured ON jobs(is_featured, featured_until);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);

-- Employer Profiles
CREATE TABLE IF NOT EXISTS employer_profiles (
  user_id TEXT PRIMARY KEY,
  company_name TEXT,
  company_logo TEXT,
  company_description TEXT,
  website TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
