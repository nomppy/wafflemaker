import { NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();

  // Check active invite count (max 5)
  const activeCount = await db
    .prepare(
      "SELECT COUNT(*) as count FROM invites WHERE from_user_id = ? AND expires_at > datetime('now') AND used = 0"
    )
    .bind(user.id)
    .first<{ count: number }>();

  if (activeCount && activeCount.count >= 5) {
    return NextResponse.json(
      { error: "You have 5 active invites. Wait for some to expire or be used." },
      { status: 429 }
    );
  }

  const id = generateId();
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await db
    .prepare(
      "INSERT INTO invites (id, from_user_id, code, expires_at) VALUES (?, ?, ?, ?)"
    )
    .bind(id, user.id, code, expiresAt)
    .run();

  return NextResponse.json({
    code,
    url: `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/invite/${code}`,
  });
}
