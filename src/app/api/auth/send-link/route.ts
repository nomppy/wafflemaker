import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, redirect } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const token = await createMagicLink(email);

  // Build magic URL with optional redirect
  const verifyUrl = new URL("/api/auth/verify", req.nextUrl.origin);
  verifyUrl.searchParams.set("token", token);
  if (redirect && typeof redirect === "string" && redirect.startsWith("/")) {
    verifyUrl.searchParams.set("redirect", redirect);
  }
  const magicUrl = verifyUrl.toString();

  // In production, send this via Resend. For now, log it and include in response for dev.
  console.log(`\n🧇 Magic link for ${email}: ${magicUrl}\n`);

  return NextResponse.json({
    ok: true,
    // Include link in dev mode for testing
    ...(process.env.NODE_ENV === "development" ? { magicUrl } : {}),
  });
}
