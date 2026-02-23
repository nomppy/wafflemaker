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
    .all<{ target_type: string; target_id: string; new_waffle: number; comments: number }>();

  // Convert empty string back to null for client
  return NextResponse.json(results.map(r => ({
    ...r,
    target_id: r.target_id || null,
  })));
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
  // Use empty string instead of NULL for global settings (SQLite NULL != NULL in UNIQUE)
  const effectiveTargetId = target_id || "";

  // Try update first, then insert if no rows affected
  const updateResult = await db
    .prepare(
      `UPDATE notification_settings SET new_waffle = ?, comments = ?
       WHERE user_id = ? AND target_type = ? AND target_id = ?`
    )
    .bind(new_waffle ? 1 : 0, comments ? 1 : 0, user.id, target_type, effectiveTargetId)
    .run();

  if (!updateResult.meta.changes) {
    await db
      .prepare(
        `INSERT INTO notification_settings (id, user_id, target_type, target_id, new_waffle, comments)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, user.id, target_type, effectiveTargetId, new_waffle ? 1 : 0, comments ? 1 : 0)
      .run();
  }

  return NextResponse.json({ ok: true });
}
