-- Strict mode: Wednesday-only waffles. Requires all members to opt in, any member can opt out.
-- For pairs: stored on pairs table
-- For circles: stored on circles table

ALTER TABLE pairs ADD COLUMN strict_mode INTEGER DEFAULT 0;
ALTER TABLE pairs ADD COLUMN strict_proposed_by TEXT;

ALTER TABLE circles ADD COLUMN strict_mode INTEGER DEFAULT 0;

-- Track per-member opt-in for strict mode
CREATE TABLE IF NOT EXISTS strict_mode_votes (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL, -- 'pair' or 'circle'
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote INTEGER NOT NULL DEFAULT 0, -- 1 = opted in, 0 = opted out
  UNIQUE(target_type, target_id, user_id)
);
