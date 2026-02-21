/**
 * Seed test data for Wafflemaker development.
 *
 * Creates test users, a pair, generates real .webm audio files,
 * inserts waffles with those audio files, and adds timed comments.
 *
 * Usage: npx tsx scripts/seed-test-data.ts
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execSync } from "child_process";

const DB_PATH = path.join(process.cwd(), "waffles.db");
const STORAGE_DIR = path.join(process.cwd(), ".storage");

function generateId(): string {
  return crypto.randomUUID();
}

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function generateTestAudio(filename: string, durationSecs: number, freqHz: number): string {
  ensureStorage();
  const outPath = path.join(STORAGE_DIR, filename);
  if (fs.existsSync(outPath)) return outPath;

  // Generate a sine wave tone as .webm using ffmpeg
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=${freqHz}:duration=${durationSecs}" ` +
    `-c:a libopus -b:a 32k "${outPath}" 2>/dev/null`,
    { stdio: "pipe" }
  );
  return outPath;
}

function main() {
  // Open (or create) DB and run migrations
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  // Run the same migration as the app
  // We import from the built module — but since this is a standalone script,
  // we'll inline the essential table creation
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

  // Check if seed data already exists
  const existingSeed = db.prepare("SELECT id FROM users WHERE email = ?").get("seed-alice@test.com");
  if (existingSeed) {
    console.log("Seed data already exists. Skipping.");
    db.close();
    return;
  }

  // Create users
  const aliceId = generateId();
  const bobId = generateId();

  db.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)").run(aliceId, "seed-alice@test.com", "Alice");
  db.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)").run(bobId, "seed-bob@test.com", "Bob");
  console.log("Created users: Alice, Bob");

  // Create sessions (expire in 30 days) so they can log in
  const aliceSessionId = generateId();
  const bobSessionId = generateId();
  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(aliceSessionId, aliceId, sessionExpiry);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(bobSessionId, bobId, sessionExpiry);
  console.log("Created sessions for both users");

  // Create pair
  const pairId = generateId();
  db.prepare("INSERT INTO pairs (id, user_a_id, user_b_id) VALUES (?, ?, ?)").run(pairId, aliceId, bobId);
  console.log(`Created pair: ${pairId}`);

  // Generate real audio files
  console.log("Generating test audio files...");
  const audio1Key = `${generateId()}.webm`;
  const audio2Key = `${generateId()}.webm`;
  const audio3Key = `${generateId()}.webm`;

  generateTestAudio(audio1Key, 5, 440);  // 5s, A4 note
  generateTestAudio(audio2Key, 8, 523);  // 8s, C5 note
  generateTestAudio(audio3Key, 3, 659);  // 3s, E5 note
  console.log("Generated 3 test audio files in .storage/");

  // Create waffles
  const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();

  const waffle1Id = generateId();
  const waffle2Id = generateId();
  const waffle3Id = generateId();

  // Alice's first waffle (5 minutes ago)
  const time1 = new Date(now.getTime() - 5 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
  db.prepare(
    "INSERT INTO waffles (id, pair_id, sender_id, storage_key, duration_seconds, transcript, title, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(waffle1Id, pairId, aliceId, audio1Key, 5, "Hey Bob, just wanted to catch up. Had a great week at work and tried that new coffee place downtown.", "Weekly catchup", time1, expiresAt);

  // Bob's reply (3 minutes ago)
  const time2 = new Date(now.getTime() - 3 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
  db.prepare(
    "INSERT INTO waffles (id, pair_id, sender_id, storage_key, duration_seconds, transcript, title, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(waffle2Id, pairId, bobId, audio2Key, 8, "Oh nice! I actually went there last week too. The cortado was amazing. Also, did you see the game last night?", "Coffee and sports", time2, expiresAt);

  // Alice's second waffle (1 minute ago)
  const time3 = new Date(now.getTime() - 1 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
  db.prepare(
    "INSERT INTO waffles (id, pair_id, sender_id, storage_key, duration_seconds, transcript, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(waffle3Id, pairId, aliceId, audio3Key, 3, "Yes! What a finish. We should watch the next one together.", time3, expiresAt);

  console.log("Created 3 waffles with real audio");

  // Add timed comments
  const comment1Id = generateId();
  const comment2Id = generateId();
  const comment3Id = generateId();

  db.prepare("INSERT INTO comments (id, waffle_id, user_id, text, timestamp_seconds) VALUES (?, ?, ?, ?, ?)").run(
    comment1Id, waffle1Id, bobId, "Ooh which coffee place?", 2.5
  );
  db.prepare("INSERT INTO comments (id, waffle_id, user_id, text, timestamp_seconds) VALUES (?, ?, ?, ?, ?)").run(
    comment2Id, waffle2Id, aliceId, "The cortado is SO good", 3.0
  );
  db.prepare("INSERT INTO comments (id, waffle_id, user_id, text, timestamp_seconds) VALUES (?, ?, ?, ?, ?)").run(
    comment3Id, waffle2Id, aliceId, "Haha yes I did!", 6.5
  );
  console.log("Added 3 timed comments");

  console.log("\nSeed complete! Test data:");
  console.log(`  Pair ID: ${pairId}`);
  console.log(`  Alice session: ${aliceSessionId}`);
  console.log(`  Bob session: ${bobSessionId}`);
  console.log("\nTo test in browser:");
  console.log(`  1. Set cookie: session=${aliceSessionId}`);
  console.log(`  2. Visit: http://localhost:3000/pair/${pairId}`);

  db.close();
}

main();
