export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "crypto";

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
  const member = db
    .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
    .get(circleId, user.id);

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const id = generateId();
  const code = crypto.randomBytes(6).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    "INSERT INTO invites (id, from_user_id, code, circle_id, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, user.id, code, circleId, expiresAt);

  return NextResponse.json({
    code,
    url: `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/invite/${code}`,
  });
}
