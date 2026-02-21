export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ waffleId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { waffleId } = await params;
  const db = getDb();

  // Verify user has access to this waffle's pair
  const waffle = db
    .prepare(
      `SELECT w.id FROM waffles w
       JOIN pairs p ON p.id = w.pair_id
       WHERE w.id = ? AND (p.user_a_id = ? OR p.user_b_id = ?)`
    )
    .get(waffleId, user.id, user.id);

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reactions = db
    .prepare(
      `SELECT r.id, r.user_id, r.emoji, r.timestamp_seconds, r.created_at,
              u.display_name as user_name
       FROM reactions r
       JOIN users u ON u.id = r.user_id
       WHERE r.waffle_id = ?
       ORDER BY r.timestamp_seconds ASC`
    )
    .all(waffleId);

  return NextResponse.json(reactions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ waffleId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { waffleId } = await params;
  const body = await req.json();
  const { emoji, timestampSeconds } = body;

  if (!emoji || timestampSeconds == null) {
    return NextResponse.json(
      { error: "emoji and timestampSeconds required" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify user has access to this waffle's pair
  const waffle = db
    .prepare(
      `SELECT w.id FROM waffles w
       JOIN pairs p ON p.id = w.pair_id
       WHERE w.id = ? AND (p.user_a_id = ? OR p.user_b_id = ?)`
    )
    .get(waffleId, user.id, user.id);

  if (!waffle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const id = generateId();
  db.prepare(
    "INSERT INTO reactions (id, waffle_id, user_id, emoji, timestamp_seconds) VALUES (?, ?, ?, ?, ?)"
  ).run(id, waffleId, user.id, emoji, timestampSeconds);

  return NextResponse.json({ id, ok: true });
}
