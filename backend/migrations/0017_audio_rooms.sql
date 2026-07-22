CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  status TEXT DEFAULT 'live',
  participant_count INTEGER DEFAULT 0,
  scheduled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS room_chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_room_chat_room_id ON room_chat_messages (room_id);

CREATE TABLE IF NOT EXISTS room_participants (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')),
  left_at TEXT,
  PRIMARY KEY (room_id, user_id)
);