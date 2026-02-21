import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateId, generateToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("github_oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  // Get user email from GitHub
  const emailsRes = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Wafflemaker",
    },
  });
  const emails = await emailsRes.json();
  const primaryEmail = emails.find(
    (e: { primary: boolean; verified: boolean; email: string }) =>
      e.primary && e.verified
  )?.email;

  if (!primaryEmail) {
    return NextResponse.redirect(new URL("/login?error=no_email", req.url));
  }

  // Get GitHub user profile for display name
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Wafflemaker",
    },
  });
  const ghUser = await userRes.json();

  // Get or create user
  const db = getDb();
  const normalized = primaryEmail.toLowerCase();
  let user = await db
    .prepare("SELECT id, email, display_name FROM users WHERE email = ?")
    .bind(normalized)
    .first<{ id: string; email: string; display_name: string }>();

  if (!user) {
    const id = generateId();
    const name = ghUser.name || ghUser.login || normalized.split("@")[0];
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
  response.cookies.delete("github_oauth_state");

  return response;
}
