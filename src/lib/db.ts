import Database from "better-sqlite3";
import path from "path";

// Use globalThis to survive Turbopack HMR/module reloads
const globalDb = globalThis as unknown as { __waffleDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalDb.__waffleDb) {
    const dbPath = path.join(process.cwd(), "waffles.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalDb.__waffleDb = db;
  }
  return globalDb.__waffleDb;
}

function migrate(db: Database.Database) {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      code TEXT UNIQUE NOT NULL,
      accepted_by_user_id TEXT REFERENCES users(id),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waffles (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL REFERENCES pairs(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      storage_key TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      transcript TEXT NOT NULL DEFAULT '',
      word_timestamps TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      waffle_id TEXT NOT NULL REFERENCES waffles(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      emoji TEXT NOT NULL,
      timestamp_seconds REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add word_timestamps column if missing
  const cols = db.prepare("PRAGMA table_info(waffles)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "word_timestamps")) {
    db.exec("ALTER TABLE waffles ADD COLUMN word_timestamps TEXT NOT NULL DEFAULT ''");
  }
}
