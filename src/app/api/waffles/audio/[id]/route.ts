export const runtime = "edge";

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

  const waffle = await db
    .prepare(
      `SELECT w.storage_key
       FROM waffles w
       LEFT JOIN pairs p ON p.id = w.pair_id
       LEFT JOIN circle_members cm ON cm.circle_id = w.circle_id AND cm.user_id = ?
       WHERE w.id = ? AND (
         (p.user_a_id = ? OR p.user_b_id = ?) OR cm.user_id IS NOT NULL
       )`
    )
    .bind(user.id, id, user.id, user.id)
    .first<{ storage_key: string }>();

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const audio = await getAudio(waffle.storage_key);
  if (!audio) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  return new NextResponse(audio.body, {
    headers: {
      "Content-Type": "audio/webm",
      "Content-Length": (audio.size || 0).toString(),
    },
  });
}
