export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { saveAudio } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const pairId = formData.get("pairId") as string;
  const audio = formData.get("audio") as File;
  const duration = parseInt(formData.get("duration") as string) || 0;
  const transcript = (formData.get("transcript") as string) || "";
  const wordTimestamps = (formData.get("word_timestamps") as string) || "";

  if (!pairId || !audio) {
    return NextResponse.json({ error: "pairId and audio required" }, { status: 400 });
  }

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

  const id = generateId();
  const storageKey = `${id}.webm`;
  const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(); // 4 weeks

  const buffer = Buffer.from(await audio.arrayBuffer());
  saveAudio(storageKey, buffer);

  db.prepare(
    "INSERT INTO waffles (id, pair_id, sender_id, storage_key, duration_seconds, transcript, word_timestamps, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, pairId, user.id, storageKey, duration, transcript, wordTimestamps, expiresAt);

  return NextResponse.json({ id, ok: true });
}
