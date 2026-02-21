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
  const pairId = (formData.get("pairId") as string) || null;
  const circleId = (formData.get("circleId") as string) || null;
  const audio = formData.get("audio") as File;
  const duration = parseInt(formData.get("duration") as string) || 0;
  const transcript = (formData.get("transcript") as string) || "";
  const wordTimestamps = (formData.get("word_timestamps") as string) || "";

  if ((!pairId && !circleId) || !audio) {
    return NextResponse.json({ error: "pairId or circleId, and audio required" }, { status: 400 });
  }

  const db = getDb();

  if (pairId) {
    // Verify user is in this pair
    const pair = db
      .prepare(
        "SELECT id FROM pairs WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)"
      )
      .get(pairId, user.id, user.id);
    if (!pair) {
      return NextResponse.json({ error: "Pair not found" }, { status: 404 });
    }
  }

  if (circleId) {
    // Verify user is in this circle
    const member = db
      .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
      .get(circleId, user.id);
    if (!member) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
  }

  const id = generateId();
  const storageKey = `${id}.webm`;
  const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(); // 4 weeks

  const buffer = Buffer.from(await audio.arrayBuffer());
  saveAudio(storageKey, buffer);

  db.prepare(
    "INSERT INTO waffles (id, pair_id, circle_id, sender_id, storage_key, duration_seconds, transcript, word_timestamps, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, pairId, circleId, user.id, storageKey, duration, transcript, wordTimestamps, expiresAt);

  return NextResponse.json({ id, ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { waffleId, title, tags } = body;

  if (!waffleId) {
    return NextResponse.json({ error: "waffleId required" }, { status: 400 });
  }

  const db = getDb();

  // Verify user owns this waffle
  const waffle = db
    .prepare("SELECT id FROM waffles WHERE id = ? AND sender_id = ?")
    .get(waffleId, user.id);

  if (!waffle) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }

  if (title !== undefined) {
    db.prepare("UPDATE waffles SET title = ? WHERE id = ?").run(title, waffleId);
  }
  if (tags !== undefined) {
    db.prepare("UPDATE waffles SET tags = ? WHERE id = ?").run(tags, waffleId);
  }

  return NextResponse.json({ ok: true });
}
