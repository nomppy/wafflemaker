import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { circleId } = await params;
  const db = getDb();

  // Verify membership
  const member = await db
    .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
    .bind(circleId, user.id)
    .first();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 404 });
  }

  // Remove from circle
  await db
    .prepare("DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?")
    .bind(circleId, user.id)
    .run();

  // If no members left, delete the circle
  const remaining = await db
    .prepare("SELECT COUNT(*) as count FROM circle_members WHERE circle_id = ?")
    .bind(circleId)
    .first<{ count: number }>();

  if (remaining && remaining.count === 0) {
    await db.prepare("DELETE FROM circles WHERE id = ?").bind(circleId).run();
  }

  return NextResponse.json({ ok: true });
}
