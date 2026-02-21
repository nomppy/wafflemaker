export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ waffleId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { waffleId } = await params;
  const body = await req.json();
  const { text, timestampSeconds } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0 || timestampSeconds == null) {
    return NextResponse.json(
      { error: "text and timestampSeconds required" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify user has access via pair or circle
  const waffle = db
    .prepare(
      `SELECT w.id FROM waffles w
       LEFT JOIN pairs p ON p.id = w.pair_id
       LEFT JOIN circle_members cm ON cm.circle_id = w.circle_id AND cm.user_id = ?
       WHERE w.id = ? AND (
         (p.user_a_id = ? OR p.user_b_id = ?) OR cm.user_id IS NOT NULL
       )`
    )
    .get(user.id, waffleId, user.id, user.id);

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const id = generateId();
  db.prepare(
    "INSERT INTO comments (id, waffle_id, user_id, text, timestamp_seconds) VALUES (?, ?, ?, ?, ?)"
  ).run(id, waffleId, user.id, text.trim(), timestampSeconds);

  return NextResponse.json({ id, ok: true });
}
