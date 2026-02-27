import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { saveAudio } from "@/lib/storage";
import { sendNotificationToUser } from "@/lib/web-push";

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
  const title = (formData.get("title") as string) || "";

  if ((!pairId && !circleId) || !audio) {
    return NextResponse.json({ error: "pairId or circleId, and audio required" }, { status: 400 });
  }

  const MAX_AUDIO_SIZE = 5 * 1024 * 1024; // 5MB
  if (audio.size > MAX_AUDIO_SIZE) {
    return NextResponse.json({ error: "Audio file too large (max 5MB)" }, { status: 413 });
  }

  const db = getDb();

  if (pairId) {
    // Verify user is in this pair
    const pair = await db
      .prepare(
        "SELECT id FROM pairs WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)"
      )
      .bind(pairId, user.id, user.id)
      .first();
    if (!pair) {
      return NextResponse.json({ error: "Pair not found" }, { status: 404 });
    }
  }

  if (circleId) {
    // Verify user is in this circle
    const member = await db
      .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
      .bind(circleId, user.id)
      .first();
    if (!member) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
  }

  // Strict mode: only allow sending on Wednesdays (sender's local time sent via header, fallback to UTC)
  const targetType = pairId ? "pair" : "circle";
  const targetId = pairId || circleId;
  const table = targetType === "pair" ? "pairs" : "circles";
  const strictRow = await db
    .prepare(`SELECT strict_mode FROM ${table} WHERE id = ?`)
    .bind(targetId)
    .first<{ strict_mode: number }>();

  if (strictRow?.strict_mode) {
    // Check if it's Wednesday in UTC (day 3)
    const now = new Date();
    const day = now.getUTCDay();
    if (day !== 3) {
      return NextResponse.json(
        { error: "Strict mode is on — waffles can only be sent on Wednesdays!" },
        { status: 403 }
      );
    }
  }

  const id = generateId();
  const storageKey = `${id}.webm`;
  const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(); // 4 weeks

  const arrayBuffer = await audio.arrayBuffer();
  await saveAudio(storageKey, arrayBuffer);

  await db
    .prepare(
      "INSERT INTO waffles (id, pair_id, circle_id, sender_id, storage_key, duration_seconds, transcript, word_timestamps, title, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, pairId, circleId, user.id, storageKey, duration, transcript, wordTimestamps, title, expiresAt)
    .run();

  // Send push notifications to other members (fire-and-forget)
  try {
    if (pairId) {
      const pair = await db
        .prepare("SELECT user_a_id, user_b_id FROM pairs WHERE id = ?")
        .bind(pairId)
        .first<{ user_a_id: string; user_b_id: string }>();
      if (pair) {
        const recipientId = pair.user_a_id === user.id ? pair.user_b_id : pair.user_a_id;
        // Check notification settings
        const setting = await db
          .prepare(
            `SELECT new_waffle FROM notification_settings
             WHERE user_id = ? AND ((target_type = 'pair' AND target_id = ?) OR (target_type = 'global' AND (target_id IS NULL OR target_id = '')))
             ORDER BY CASE WHEN target_id IS NOT NULL THEN 0 ELSE 1 END LIMIT 1`
          )
          .bind(recipientId, pairId)
          .first<{ new_waffle: number }>();
        // Default to enabled if no setting exists
        if (!setting || setting.new_waffle) {
          sendNotificationToUser(recipientId, {
            title: "New Waffle!",
            body: `${user.display_name} sent you a waffle`,
            url: `/pair/${pairId}`,
          }).catch((err) => console.error("Push send error:", err));
        }
      }
    }
    if (circleId) {
      const { results: circleMembers } = await db
        .prepare("SELECT user_id FROM circle_members WHERE circle_id = ? AND user_id != ?")
        .bind(circleId, user.id)
        .all<{ user_id: string }>();
      const circleName = await db
        .prepare("SELECT name FROM circles WHERE id = ?")
        .bind(circleId)
        .first<{ name: string }>();
      for (const member of circleMembers) {
        const setting = await db
          .prepare(
            `SELECT new_waffle FROM notification_settings
             WHERE user_id = ? AND ((target_type = 'circle' AND target_id = ?) OR (target_type = 'global' AND (target_id IS NULL OR target_id = '')))
             ORDER BY CASE WHEN target_id IS NOT NULL THEN 0 ELSE 1 END LIMIT 1`
          )
          .bind(member.user_id, circleId)
          .first<{ new_waffle: number }>();
        if (!setting || setting.new_waffle) {
          sendNotificationToUser(member.user_id, {
            title: `New Waffle in ${circleName?.name || "circle"}`,
            body: `${user.display_name} posted a waffle`,
            url: `/circle/${circleId}`,
          }).catch((err) => console.error("Push send error:", err));
        }
      }
    }
  } catch {
    // Push notification failures should not block the response
  }

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
  const waffle = await db
    .prepare("SELECT id FROM waffles WHERE id = ? AND sender_id = ?")
    .bind(waffleId, user.id)
    .first();

  if (!waffle) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }

  if (title !== undefined) {
    await db.prepare("UPDATE waffles SET title = ? WHERE id = ?").bind(title, waffleId).run();
  }
  if (tags !== undefined) {
    await db.prepare("UPDATE waffles SET tags = ? WHERE id = ?").bind(tags, waffleId).run();
  }

  return NextResponse.json({ ok: true });
}
