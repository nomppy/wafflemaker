import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(
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
  const pair = await db
    .prepare("SELECT id FROM pairs WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)")
    .bind(pairId, user.id, user.id)
    .first();

  if (!pair) {
    return NextResponse.json({ error: "Pair not found" }, { status: 404 });
  }

  // Delete the pair (waffles will remain but pair link is gone)
  await db.prepare("DELETE FROM pairs WHERE id = ?").bind(pairId).run();

  return NextResponse.json({ ok: true });
}
