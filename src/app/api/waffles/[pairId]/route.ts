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
      `SELECT w.id, w.sender_id, w.duration_seconds, w.transcript, w.word_timestamps, w.title, w.tags, w.reply_to_id, w.reply_to_timestamp, w.created_at,
              u.display_name as sender_name
       FROM waffles w
       JOIN users u ON u.id = w.sender_id
       WHERE w.pair_id = ?
       ORDER BY w.created_at ASC
       LIMIT 50`
    )
    .all(pairId) as Record<string, unknown>[];

  // Attach reactions to each waffle
  const getReactions = db.prepare(
    `SELECT r.id, r.user_id, r.emoji, r.timestamp_seconds, r.created_at,
            u.display_name as user_name
     FROM reactions r
     JOIN users u ON u.id = r.user_id
     WHERE r.waffle_id = ?
     ORDER BY r.timestamp_seconds ASC`
  );

  const wafflesWithReactions = waffles.map((w) => ({
    ...w,
    reactions: getReactions.all(w.id as string),
  }));

  return NextResponse.json(wafflesWithReactions);
}
