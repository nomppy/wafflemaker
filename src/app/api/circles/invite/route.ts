import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { circleId } = body;

  if (!circleId) {
    return NextResponse.json({ error: "circleId required" }, { status: 400 });
  }

  const db = getDb();

  // Verify user is a member of the circle
  const member = await db
    .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
    .bind(circleId, user.id)
    .first();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const id = generateId();
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      "INSERT INTO invites (id, from_user_id, code, circle_id, expires_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, user.id, code, circleId, expiresAt)
    .run();

  return NextResponse.json({
    code,
    url: `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/invite/${code}`,
  });
}
