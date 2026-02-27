CREATE TABLE IF NOT EXISTS last_visited (
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id)
);
