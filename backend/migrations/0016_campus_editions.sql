CREATE TABLE IF NOT EXISTS campus_editions (
  id TEXT PRIMARY KEY,
  university_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  representative_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  annual_fee_cents INTEGER DEFAULT 500000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);