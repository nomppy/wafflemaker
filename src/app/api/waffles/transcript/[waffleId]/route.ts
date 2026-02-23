import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ waffleId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { waffleId } = await params;
  const { transcript } = await req.json();

  if (typeof transcript !== "string") {
    return NextResponse.json({ error: "Invalid transcript" }, { status: 400 });
  }

  const db = getDb();

  const waffle = await db
    .prepare("SELECT sender_id FROM waffles WHERE id = ?")
    .bind(waffleId)
    .first();

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (waffle.sender_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .prepare("UPDATE waffles SET transcript = ? WHERE id = ?")
    .bind(transcript.trim(), waffleId)
    .run();

  return NextResponse.json({ ok: true });
}
