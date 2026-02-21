export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { circleId } = await params;
  const db = getDb();

  // Verify user is a member
  const member = db
    .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
    .get(circleId, user.id);

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Get circle info
  const circle = db
    .prepare("SELECT id, name, created_by, created_at FROM circles WHERE id = ?")
    .get(circleId);

  // Get members
  const members = db
    .prepare(
      `SELECT u.id, u.display_name, u.email
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = ?`
    )
    .all(circleId);

  // Get waffles
  const waffles = db
    .prepare(
      `SELECT w.id, w.sender_id, w.duration_seconds, w.transcript, w.word_timestamps, w.title, w.tags, w.reply_to_id, w.reply_to_timestamp, w.created_at,
              u.display_name as sender_name
       FROM waffles w
       JOIN users u ON u.id = w.sender_id
       WHERE w.circle_id = ?
       ORDER BY w.created_at ASC
       LIMIT 100`
    )
    .all(circleId) as Record<string, unknown>[];

  // Attach comments
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

  return NextResponse.json({ circle, members, waffles: wafflesWithComments });
}
