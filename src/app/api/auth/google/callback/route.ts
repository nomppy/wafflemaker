import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateId, generateToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();

  // Exchange code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  // Get user info from Google
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const gUser = await userRes.json();

  if (!gUser.email || !gUser.verified_email) {
    return NextResponse.redirect(new URL("/login?error=no_email", req.url));
  }

  // Get or create user
  const db = getDb();
  const normalized = gUser.email.toLowerCase();
  let user = await db
    .prepare("SELECT id, email, display_name FROM users WHERE email = ?")
    .bind(normalized)
    .first<{ id: string; email: string; display_name: string }>();

  if (!user) {
    const id = generateId();
    const name = gUser.name || normalized.split("@")[0];
    await db
      .prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)")
      .bind(id, normalized, name)
      .run();
    user = { id, email: normalized, display_name: name };
  }

  // Create session
  const sessionId = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, user.id, expiresAt)
    .run();

  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  response.cookies.set("session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  response.cookies.delete("google_oauth_state");

  return response;
}
