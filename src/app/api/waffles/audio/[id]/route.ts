export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAudio } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const waffle = db
    .prepare(
      `SELECT w.storage_key, w.pair_id
       FROM waffles w
       JOIN pairs p ON p.id = w.pair_id
       WHERE w.id = ? AND (p.user_a_id = ? OR p.user_b_id = ?)`
    )
    .get(id, user.id, user.id) as { storage_key: string; pair_id: string } | undefined;

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const audio = getAudio(waffle.storage_key);
  if (!audio) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/webm",
      "Content-Length": audio.length.toString(),
    },
  });
}
