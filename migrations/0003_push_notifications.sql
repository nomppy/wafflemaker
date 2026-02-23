CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  new_waffle INTEGER DEFAULT 1,
  comments INTEGER DEFAULT 1,
  UNIQUE(user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
