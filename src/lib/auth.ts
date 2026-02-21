import { cookies } from "next/headers";
import { getDb } from "./db";
import crypto from "crypto";

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createMagicLink(email: string): string {
  const db = getDb();
  const id = generateId();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  db.prepare(
    "INSERT INTO magic_links (id, email, token, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, email.toLowerCase(), token, expiresAt);

  return token;
}

export function verifyMagicLink(token: string): { email: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT email, expires_at, used FROM magic_links WHERE token = ?"
    )
    .get(token) as { email: string; expires_at: string; used: number } | undefined;

  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return null;
  }

  db.prepare("UPDATE magic_links SET used = 1 WHERE token = ?").run(token);
  return { email: row.email };
}

export function getOrCreateUser(email: string): { id: string; email: string; display_name: string } {
  const db = getDb();
  const normalized = email.toLowerCase();

  let user = db
    .prepare("SELECT id, email, display_name FROM users WHERE email = ?")
    .get(normalized) as { id: string; email: string; display_name: string } | undefined;

  if (!user) {
    const id = generateId();
    const name = normalized.split("@")[0];
    db.prepare(
      "INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)"
    ).run(id, normalized, name);
    user = { id, email: normalized, display_name: name };
  }

  return user;
}

export function createSession(userId: string): string {
  const db = getDb();
  const id = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(id, userId, expiresAt);

  return id;
}

export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  display_name: string;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionToken) as {
    id: string;
    email: string;
    display_name: string;
    expires_at: string;
  } | undefined;

  if (!row || new Date(row.expires_at) < new Date()) {
    return null;
  }

  return { id: row.id, email: row.email, display_name: row.display_name };
}
