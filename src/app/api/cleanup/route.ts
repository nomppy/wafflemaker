import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteAudio } from "@/lib/storage";

export async function POST(req: NextRequest) {
  // Simple secret check to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CLEANUP_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find waffles older than 7 days that still have audio
  const { results: expired } = await db
    .prepare(
      "SELECT id, storage_key FROM waffles WHERE created_at < ? AND storage_key != ''"
    )
    .bind(cutoff)
    .all<{ id: string; storage_key: string }>();

  let deleted = 0;
  for (const waffle of expired) {
    try {
      await deleteAudio(waffle.storage_key);
      // Clear the storage_key so we don't try to delete again
      await db
        .prepare("UPDATE waffles SET storage_key = '' WHERE id = ?")
        .bind(waffle.id)
        .run();
      deleted++;
    } catch (err) {
      console.error(`Failed to delete audio for waffle ${waffle.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    expired: expired.length,
    deleted,
  });
}
