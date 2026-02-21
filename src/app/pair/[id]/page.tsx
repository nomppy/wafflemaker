export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { PairView } from "./pair-view";

export default async function PairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: pairId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const pair = db
    .prepare(
      `SELECT p.id,
              CASE WHEN p.user_a_id = ? THEN ub.display_name ELSE ua.display_name END as partner_name
       FROM pairs p
       JOIN users ua ON ua.id = p.user_a_id
       JOIN users ub ON ub.id = p.user_b_id
       WHERE p.id = ? AND (p.user_a_id = ? OR p.user_b_id = ?)`
    )
    .get(user.id, pairId, user.id, user.id) as {
    id: string;
    partner_name: string;
  } | undefined;

  if (!pair) redirect("/dashboard");

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
          {pair.partner_name}
        </h1>
      </div>
      <PairView pairId={pairId} currentUserId={user.id} />
    </main>
  );
}
