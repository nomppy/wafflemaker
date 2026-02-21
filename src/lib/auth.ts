import { cookies } from "next/headers";
import { getDb } from "./db";

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createMagicLink(email: string): Promise<string> {
  const db = getDb();
  const id = generateId();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  await db
    .prepare(
      "INSERT INTO magic_links (id, email, token, expires_at) VALUES (?, ?, ?, ?)"
    )
    .bind(id, email.toLowerCase(), token, expiresAt)
    .run();

  return token;
}

export async function verifyMagicLink(
  token: string
): Promise<{ email: string } | null> {
  const db = getDb();
  const row = await db
    .prepare(
      "SELECT email, expires_at, used FROM magic_links WHERE token = ?"
    )
    .bind(token)
    .first<{ email: string; expires_at: string; used: number }>();

  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return null;
  }

  await db
    .prepare("UPDATE magic_links SET used = 1 WHERE token = ?")
    .bind(token)
    .run();
  return { email: row.email };
}

export async function getOrCreateUser(
  email: string
): Promise<{ id: string; email: string; display_name: string }> {
  const db = getDb();
  const normalized = email.toLowerCase();

  let user = await db
    .prepare("SELECT id, email, display_name FROM users WHERE email = ?")
    .bind(normalized)
    .first<{ id: string; email: string; display_name: string }>();

  if (!user) {
    const id = generateId();
    const name = normalized.split("@")[0];
    await db
      .prepare(
        "INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)"
      )
      .bind(id, normalized, name)
      .run();
    user = { id, email: normalized, display_name: name };
  }

  return user;
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const id = generateToken();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString(); // 30 days

  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    )
    .bind(id, userId, expiresAt)
    .run();

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
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sessionToken)
    .first<{
      id: string;
      email: string;
      display_name: string;
      expires_at: string;
    }>();

  if (!row || new Date(row.expires_at) < new Date()) {
    return null;
  }

  return { id: row.id, email: row.email, display_name: row.display_name };
}
