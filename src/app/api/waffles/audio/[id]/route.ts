import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAudio } from "@/lib/storage";

function detectContentType(buf: ArrayBuffer): string {
  const h = new Uint8Array(buf.slice(0, 12));
  // MP4/M4A: ftyp box at offset 4
  if (h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) {
    return "audio/mp4";
  }
  return "audio/webm";
}

export async function GET(
  req: NextRequest,
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

  const arrayBuffer = await audio.arrayBuffer();
  const totalSize = arrayBuffer.byteLength;
  const contentType = detectContentType(arrayBuffer);

  // Handle Range requests (required for iOS Safari audio playback)
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      return new NextResponse(arrayBuffer.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  // Full response
  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": totalSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
