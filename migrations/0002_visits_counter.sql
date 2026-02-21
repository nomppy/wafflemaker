-- Visit counter for the landing page
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO visits (id, count) VALUES (1, 0);
