import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { displayName } = await req.json();

  if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const name = displayName.trim().slice(0, 50);
  const db = getDb();
  await db
    .prepare("UPDATE users SET display_name = ? WHERE id = ?")
    .bind(name, user.id)
    .run();

  return NextResponse.json({ ok: true, display_name: name });
}
