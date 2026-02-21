import { getDb } from "./db";

export function getStreak(pairId: string, userId: string): number {
  const db = getDb();

  // Get all distinct weeks (by Wednesday) where this user sent a waffle in this pair
  // A "week" is defined by the Wednesday it belongs to
  const rows = db
    .prepare(
      `SELECT DISTINCT date(w.created_at, 'weekday 3') as wednesday
       FROM waffles w
       WHERE w.pair_id = ? AND w.sender_id = ?
       ORDER BY wednesday DESC`
    )
    .all(pairId, userId) as { wednesday: string }[];

  if (rows.length === 0) return 0;

  // Check if the most recent waffle is from this week or last week
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  // Get this week's Wednesday
  const daysUntilWed = (3 - dayOfWeek + 7) % 7;
  const daysSinceWed = dayOfWeek <= 3 ? (dayOfWeek + 4) % 7 : dayOfWeek - 3;
  const thisWednesday = new Date(today);
  if (dayOfWeek <= 3) {
    thisWednesday.setDate(today.getDate() + daysUntilWed);
  } else {
    thisWednesday.setDate(today.getDate() - daysSinceWed);
  }

  const latestWed = new Date(rows[0].wednesday + "T00:00:00");
  const diffDays = Math.round(
    (thisWednesday.getTime() - latestWed.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If the latest waffle Wednesday is more than 7 days ago, streak is broken
  if (diffDays > 7) return 0;

  // Count consecutive weeks
  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].wednesday + "T00:00:00");
    const curr = new Date(rows[i].wednesday + "T00:00:00");
    const gap = Math.round(
      (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (gap === 7) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
