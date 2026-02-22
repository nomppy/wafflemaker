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

  // Detect content type from the first bytes of the file
  // Browsers record audio in different formats:
  //   - Chrome: audio/webm (starts with 0x1A45DFA3 = EBML/WebM)
  //   - Safari/iOS: audio/mp4 (starts with ftyp)
  const arrayBuffer = await audio.arrayBuffer();
  const header = new Uint8Array(arrayBuffer.slice(0, 12));
  let contentType = "audio/webm"; // default

  // Check for MP4/M4A (ftyp box at offset 4)
  if (
    header[4] === 0x66 && // f
    header[5] === 0x74 && // t
    header[6] === 0x79 && // y
    header[7] === 0x70    // p
  ) {
    contentType = "audio/mp4";
  }

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": arrayBuffer.byteLength.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
