export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pairId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { pairId } = await params;
  const db = getDb();

  // Verify user is in this pair
  const pair = db
    .prepare(
      "SELECT id FROM pairs WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)"
    )
    .get(pairId, user.id, user.id);

  if (!pair) {
    return NextResponse.json({ error: "Pair not found" }, { status: 404 });
  }

  const waffles = db
    .prepare(
      `SELECT w.id, w.sender_id, w.duration_seconds, w.transcript, w.word_timestamps, w.title, w.tags, w.created_at,
              u.display_name as sender_name
       FROM waffles w
       JOIN users u ON u.id = w.sender_id
       WHERE w.pair_id = ?
       ORDER BY w.created_at ASC
       LIMIT 50`
    )
    .all(pairId) as Record<string, unknown>[];

  // Attach comments to each waffle
  const getComments = db.prepare(
    `SELECT c.id, c.user_id, c.text, c.timestamp_seconds, c.created_at,
            u.display_name as user_name
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.waffle_id = ?
     ORDER BY c.timestamp_seconds ASC`
  );

  const wafflesWithComments = waffles.map((w) => ({
    ...w,
    comments: getComments.all(w.id as string),
  }));

  return NextResponse.json(wafflesWithComments);
}
