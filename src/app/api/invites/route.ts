import { NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();
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
