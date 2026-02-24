-- Strict mode: Wednesday-only waffles.
-- Note: strict_mode columns on pairs/circles were added via direct SQL before migrations were tracked.
-- This migration ensures the votes table exists and marks the migration as applied.

CREATE TABLE IF NOT EXISTS strict_mode_votes (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote INTEGER NOT NULL DEFAULT 0,
  UNIQUE(target_type, target_id, user_id)
);
