export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=/invite/${code}`);
  }

  const db = getDb();
  const invite = db
    .prepare(
      "SELECT id, from_user_id, accepted_by_user_id, expires_at FROM invites WHERE code = ?"
    )
    .get(code) as {
    id: string;
    from_user_id: string;
    accepted_by_user_id: string | null;
    expires_at: string;
  } | undefined;

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-amber-800">This invite link is not valid.</p>
      </main>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-amber-800">This invite has expired.</p>
      </main>
    );
  }

  if (invite.from_user_id === user.id) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-amber-800">You can&apos;t accept your own invite!</p>
      </main>
    );
  }

  if (invite.accepted_by_user_id) {
    redirect("/dashboard");
  }

  // Check if pair already exists
  const existingPair = db
    .prepare(
      `SELECT id FROM pairs
       WHERE (user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?)`
    )
    .get(invite.from_user_id, user.id, user.id, invite.from_user_id);

  if (existingPair) {
    redirect("/dashboard");
  }

  // Accept the invite and create the pair
  const pairId = generateId();
  db.prepare(
    "INSERT INTO pairs (id, user_a_id, user_b_id) VALUES (?, ?, ?)"
  ).run(pairId, invite.from_user_id, user.id);

  db.prepare(
    "UPDATE invites SET accepted_by_user_id = ? WHERE id = ?"
  ).run(user.id, invite.id);

  redirect("/dashboard");
}
