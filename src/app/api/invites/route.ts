export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "crypto";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();
  const id = generateId();
  const code = crypto.randomBytes(6).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare(
    "INSERT INTO invites (id, from_user_id, code, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, user.id, code, expiresAt);

  return NextResponse.json({
    code,
    url: `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/invite/${code}`,
  });
}
