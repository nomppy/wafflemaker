export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { CircleView } from "./circle-view";

export default async function CirclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: circleId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();

  // Verify membership
  const member = db
    .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
    .get(circleId, user.id);

  if (!member) redirect("/dashboard");

  const circle = db
    .prepare("SELECT id, name FROM circles WHERE id = ?")
    .get(circleId) as { id: string; name: string } | undefined;

  if (!circle) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="btn-retro-cream btn-retro px-4 py-1.5 text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="font-display text-xl font-bold text-syrup">
          {circle.name}
        </h1>
      </div>
      <CircleView circleId={circleId} currentUserId={user.id} />
    </main>
  );
}
