import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendNotificationToUser } from "@/lib/web-push";

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
  const waffle = await db
    .prepare(
      `SELECT w.id FROM waffles w
       LEFT JOIN pairs p ON p.id = w.pair_id
       LEFT JOIN circle_members cm ON cm.circle_id = w.circle_id AND cm.user_id = ?
       WHERE w.id = ? AND (
         (p.user_a_id = ? OR p.user_b_id = ?) OR cm.user_id IS NOT NULL
       )`
    )
    .bind(user.id, waffleId, user.id, user.id)
    .first();

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const id = generateId();
  await db
    .prepare(
      "INSERT INTO comments (id, waffle_id, user_id, text, timestamp_seconds) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, waffleId, user.id, text.trim(), timestampSeconds)
    .run();

  // Notify waffle sender about the comment (fire-and-forget)
  try {
    const waffleInfo = await db
      .prepare("SELECT sender_id, pair_id, circle_id FROM waffles WHERE id = ?")
      .bind(waffleId)
      .first<{ sender_id: string; pair_id: string | null; circle_id: string | null }>();
    if (waffleInfo && waffleInfo.sender_id !== user.id) {
      const setting = await db
        .prepare(
          `SELECT comments FROM notification_settings
           WHERE user_id = ? AND (
             (target_type = 'global' AND (target_id IS NULL OR target_id = ''))
             OR (target_type = 'pair' AND target_id = ?)
             OR (target_type = 'circle' AND target_id = ?)
           )
           ORDER BY CASE WHEN target_id IS NOT NULL THEN 0 ELSE 1 END LIMIT 1`
        )
        .bind(waffleInfo.sender_id, waffleInfo.pair_id, waffleInfo.circle_id)
        .first<{ comments: number }>();
      if (!setting || setting.comments) {
        const url = waffleInfo.pair_id
          ? `/pair/${waffleInfo.pair_id}`
          : `/circle/${waffleInfo.circle_id}`;
        sendNotificationToUser(waffleInfo.sender_id, {
          title: "New Comment",
          body: `${user.display_name} commented on your waffle`,
          url,
        });
      }
    }
  } catch {
    // Push notification failures should not block the response
  }

  return NextResponse.json({ id, ok: true });
}
