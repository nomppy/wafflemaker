import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

// GET: check strict mode status for a pair/circle
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const targetType = req.nextUrl.searchParams.get("type"); // 'pair' or 'circle'
  const targetId = req.nextUrl.searchParams.get("id");
  if (!targetType || !targetId) return NextResponse.json({ error: "Missing type/id" }, { status: 400 });

  const db = getDb();

  // Get all votes
  const { results: votes } = await db
    .prepare("SELECT user_id, vote FROM strict_mode_votes WHERE target_type = ? AND target_id = ?")
    .bind(targetType, targetId)
    .all<{ user_id: string; vote: number }>();

  // Get member count
  let memberCount = 0;
  if (targetType === "pair") {
    memberCount = 2;
  } else {
    const count = await db
      .prepare("SELECT COUNT(*) as count FROM circle_members WHERE circle_id = ?")
      .bind(targetId)
      .first<{ count: number }>();
    memberCount = count?.count || 0;
  }

  const optedIn = votes.filter(v => v.vote === 1);
  const myVote = votes.find(v => v.user_id === user.id);
  const allOptedIn = optedIn.length === memberCount && memberCount > 0;

  // Check if strict mode is active on the target
  let strictActive = false;
  if (targetType === "pair") {
    const pair = await db.prepare("SELECT strict_mode FROM pairs WHERE id = ?").bind(targetId).first<{ strict_mode: number }>();
    strictActive = !!pair?.strict_mode;
  } else {
    const circle = await db.prepare("SELECT strict_mode FROM circles WHERE id = ?").bind(targetId).first<{ strict_mode: number }>();
    strictActive = !!circle?.strict_mode;
  }

  return NextResponse.json({
    strictActive,
    myVote: myVote?.vote ?? null,
    optedInCount: optedIn.length,
    memberCount,
    allOptedIn,
  });
}

// POST: vote for strict mode
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { type: targetType, id: targetId, vote } = await req.json();
  if (!targetType || !targetId || typeof vote !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = getDb();

  // Upsert vote
  const voteId = generateId();
  const existing = await db
    .prepare("SELECT id FROM strict_mode_votes WHERE target_type = ? AND target_id = ? AND user_id = ?")
    .bind(targetType, targetId, user.id)
    .first();

  if (existing) {
    await db.prepare("UPDATE strict_mode_votes SET vote = ? WHERE target_type = ? AND target_id = ? AND user_id = ?")
      .bind(vote, targetType, targetId, user.id).run();
  } else {
    await db.prepare("INSERT INTO strict_mode_votes (id, target_type, target_id, user_id, vote) VALUES (?, ?, ?, ?, ?)")
      .bind(voteId, targetType, targetId, user.id, vote).run();
  }

  // Check if all members opted in
  let memberCount = 0;
  if (targetType === "pair") {
    memberCount = 2;
  } else {
    const count = await db.prepare("SELECT COUNT(*) as count FROM circle_members WHERE circle_id = ?")
      .bind(targetId).first<{ count: number }>();
    memberCount = count?.count || 0;
  }

  const { results: allVotes } = await db
    .prepare("SELECT vote FROM strict_mode_votes WHERE target_type = ? AND target_id = ?")
    .bind(targetType, targetId)
    .all<{ vote: number }>();

  const allOptedIn = allVotes.filter(v => v.vote === 1).length === memberCount && memberCount > 0;

  // If anyone opts out, disable strict mode
  const table = targetType === "pair" ? "pairs" : "circles";
  await db.prepare(`UPDATE ${table} SET strict_mode = ? WHERE id = ?`)
    .bind(allOptedIn ? 1 : 0, targetId).run();

  return NextResponse.json({ ok: true, strictActive: allOptedIn });
}
