-- Wafflemaker D1 schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL REFERENCES users(id),
  user_b_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id TEXT NOT NULL REFERENCES circles(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES users(id),
  code TEXT UNIQUE NOT NULL,
  accepted_by_user_id TEXT REFERENCES users(id),
  circle_id TEXT REFERENCES circles(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waffles (
  id TEXT PRIMARY KEY,
  pair_id TEXT REFERENCES pairs(id),
  circle_id TEXT REFERENCES circles(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  storage_key TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  transcript TEXT NOT NULL DEFAULT '',
  word_timestamps TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  reply_to_id TEXT REFERENCES waffles(id),
  reply_to_timestamp REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  waffle_id TEXT NOT NULL REFERENCES waffles(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL DEFAULT '',
  timestamp_seconds REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
