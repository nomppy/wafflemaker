import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteAudio } from "@/lib/storage";

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

  // Get audio storage keys before deleting waffles
  const { results: waffleKeys } = await db
    .prepare("SELECT storage_key FROM waffles WHERE pair_id = ?")
    .bind(pairId)
    .all<{ storage_key: string }>();

  // Clean up all FK references in a batch, then delete the pair
  // D1 enforces FK constraints so we must delete children first
  await db.batch([
    db.prepare("DELETE FROM comments WHERE waffle_id IN (SELECT id FROM waffles WHERE pair_id = ?)").bind(pairId),
    db.prepare("DELETE FROM waffles WHERE pair_id = ?").bind(pairId),
    db.prepare("DELETE FROM notification_settings WHERE target_type = 'pair' AND target_id = ?").bind(pairId),
    db.prepare("DELETE FROM strict_mode_votes WHERE target_type = 'pair' AND target_id = ?").bind(pairId),
    db.prepare("DELETE FROM pairs WHERE id = ?").bind(pairId),
  ]);

  // Clean up audio files from R2 (best-effort, don't block response)
  Promise.allSettled(waffleKeys.map((w) => deleteAudio(w.storage_key))).catch(() => {});

  return NextResponse.json({ ok: true });
}
