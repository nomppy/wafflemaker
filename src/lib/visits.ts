import { getDb } from "./db";

export async function recordVisit(userId: string, targetType: string, targetId: string) {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO last_visited (user_id, target_type, target_id, visited_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, target_type, target_id)
       DO UPDATE SET visited_at = datetime('now')`
    )
    .bind(userId, targetType, targetId)
    .run();
}

export async function hasNewContent(
  userId: string,
  targetType: "pair" | "circle",
  targetId: string
): Promise<boolean> {
  const db = getDb();
  const visit = await db
    .prepare("SELECT visited_at FROM last_visited WHERE user_id = ? AND target_type = ? AND target_id = ?")
    .bind(userId, targetType, targetId)
    .first<{ visited_at: string }>();

  const since = visit?.visited_at || "1970-01-01T00:00:00";

  if (targetType === "pair") {
    const newWaffle = await db
      .prepare("SELECT id FROM waffles WHERE pair_id = ? AND sender_id != ? AND created_at > ? LIMIT 1")
      .bind(targetId, userId, since)
      .first();
    if (newWaffle) return true;

    const newComment = await db
      .prepare(
        `SELECT c.id FROM comments c
         JOIN waffles w ON w.id = c.waffle_id
         WHERE w.pair_id = ? AND c.user_id != ? AND c.created_at > ? LIMIT 1`
      )
      .bind(targetId, userId, since)
      .first();
    return !!newComment;
  }

  // circle
  const newWaffle = await db
    .prepare("SELECT id FROM waffles WHERE circle_id = ? AND sender_id != ? AND created_at > ? LIMIT 1")
    .bind(targetId, userId, since)
    .first();
  if (newWaffle) return true;

  const newComment = await db
    .prepare(
      `SELECT c.id FROM comments c
       JOIN waffles w ON w.id = c.waffle_id
       WHERE w.circle_id = ? AND c.user_id != ? AND c.created_at > ? LIMIT 1`
    )
    .bind(targetId, userId, since)
    .first();
  return !!newComment;
}
