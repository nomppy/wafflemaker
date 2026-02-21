export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink, getOrCreateUser, createSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  const result = await verifyMagicLink(token);
  if (!result) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const user = await getOrCreateUser(result.email);
  const sessionId = await createSession(user.id);

  const redirectTo = req.nextUrl.searchParams.get("redirect");
  const destination = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  const response = NextResponse.redirect(new URL(destination, req.url));
  response.cookies.set("session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return response;
}
