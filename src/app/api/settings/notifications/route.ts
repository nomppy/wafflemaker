import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();
  const { results } = await db
    .prepare("SELECT target_type, target_id, new_waffle, comments FROM notification_settings WHERE user_id = ?")
    .bind(user.id)
    .all<{ target_type: string; target_id: string | null; new_waffle: number; comments: number }>();

  return NextResponse.json(results);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { target_type, target_id, new_waffle, comments } = body;

  if (!target_type) {
    return NextResponse.json({ error: "target_type required" }, { status: 400 });
  }

  const db = getDb();
  const id = generateId();

  await db
    .prepare(
      `INSERT INTO notification_settings (id, user_id, target_type, target_id, new_waffle, comments)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, target_type, target_id)
       DO UPDATE SET new_waffle = ?, comments = ?`
    )
    .bind(id, user.id, target_type, target_id || null, new_waffle ? 1 : 0, comments ? 1 : 0, new_waffle ? 1 : 0, comments ? 1 : 0)
    .run();

  return NextResponse.json({ ok: true });
}
