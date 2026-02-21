import Database from "better-sqlite3";
import path from "path";

// Bump this when adding new migrations so HMR-cached connections get updated
const MIGRATION_VERSION = 7;

// Use globalThis to survive Turbopack HMR/module reloads
const globalDb = globalThis as unknown as {
  __waffleDb?: Database.Database;
  __waffleMigVer?: number;
};

export function getDb(): Database.Database {
  if (!globalDb.__waffleDb) {
    const dbPath = path.join(process.cwd(), "waffles.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalDb.__waffleDb = db;
    globalDb.__waffleMigVer = MIGRATION_VERSION;
  } else if ((globalDb.__waffleMigVer || 0) < MIGRATION_VERSION) {
    migrate(globalDb.__waffleDb);
    globalDb.__waffleMigVer = MIGRATION_VERSION;
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
  `);

  // Ensure circles tables exist (for existing DBs opened before circles feature)
  db.exec(`
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
  `);

  // Migrations for existing DBs
  const cols = db.prepare("PRAGMA table_info(waffles)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "word_timestamps")) {
    db.exec("ALTER TABLE waffles ADD COLUMN word_timestamps TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.some((c) => c.name === "title")) {
    db.exec("ALTER TABLE waffles ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.some((c) => c.name === "tags")) {
    db.exec("ALTER TABLE waffles ADD COLUMN tags TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.some((c) => c.name === "reply_to_id")) {
    db.exec("ALTER TABLE waffles ADD COLUMN reply_to_id TEXT REFERENCES waffles(id)");
  }
  if (!cols.some((c) => c.name === "reply_to_timestamp")) {
    db.exec("ALTER TABLE waffles ADD COLUMN reply_to_timestamp REAL");
  }
  if (!cols.some((c) => c.name === "circle_id")) {
    db.exec("ALTER TABLE waffles ADD COLUMN circle_id TEXT REFERENCES circles(id)");
  }

  // Migration: create comments table (replaces old reactions table)
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      waffle_id TEXT NOT NULL REFERENCES waffles(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      text TEXT NOT NULL DEFAULT '',
      timestamp_seconds REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add circle_id to invites
  const inviteCols = db.prepare("PRAGMA table_info(invites)").all() as { name: string }[];
  if (!inviteCols.some((c) => c.name === "circle_id")) {
    db.exec("ALTER TABLE invites ADD COLUMN circle_id TEXT REFERENCES circles(id)");
  }
}
