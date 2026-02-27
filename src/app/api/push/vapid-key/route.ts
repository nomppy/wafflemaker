import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  const env = (getCloudflareContext() as any).env;
  const key = env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ error: "VAPID key not configured" }, { status: 500 });
  }
  return NextResponse.json({ key });
}
