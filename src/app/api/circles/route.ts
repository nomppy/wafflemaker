export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Circle name required" }, { status: 400 });
  }

  const db = getDb();
  const id = generateId();

  await db
    .prepare("INSERT INTO circles (id, name, created_by) VALUES (?, ?, ?)")
    .bind(id, name.trim(), user.id)
    .run();

  // Creator is automatically a member
  await db
    .prepare("INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)")
    .bind(id, user.id)
    .run();

  return NextResponse.json({ id, ok: true });
}
