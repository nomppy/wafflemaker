import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, generateId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const db = getDb();
  const invite = await db
    .prepare(
      "SELECT u.display_name FROM invites i JOIN users u ON u.id = i.from_user_id WHERE i.code = ?"
    )
    .bind(code)
    .first<{ display_name: string }>();

  const name = invite?.display_name || "Someone";

  return {
    title: `${name} invited you to Wafflemaker`,
    description:
      "Async voice pen-pals. Accept this invite to start your waffle exchange!",
    openGraph: {
      title: `${name} invited you to Wafflemaker`,
      description:
        "Record a waffle, send it to a friend, and hear back on Wednesday.",
      type: "website",
      siteName: "Wafflemaker",
    },
    twitter: {
      card: "summary",
      title: `${name} invited you to Wafflemaker`,
      description:
        "Async voice pen-pals — send voice waffles to friends every week.",
    },
  };
}

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
  const invite = await db
    .prepare(
      "SELECT id, from_user_id, accepted_by_user_id, circle_id, expires_at FROM invites WHERE code = ?"
    )
    .bind(code)
    .first<{
      id: string;
      from_user_id: string;
      accepted_by_user_id: string | null;
      circle_id: string | null;
      expires_at: string;
    }>();

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

  // Circle invite flow
  if (invite.circle_id) {
    // Check if already a member
    const existing = await db
      .prepare("SELECT circle_id FROM circle_members WHERE circle_id = ? AND user_id = ?")
      .bind(invite.circle_id, user.id)
      .first();

    if (!existing) {
      await db
        .prepare("INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)")
        .bind(invite.circle_id, user.id)
        .run();
    }

    redirect("/dashboard");
  }

  // Pair invite flow
  if (invite.accepted_by_user_id) {
    redirect("/dashboard");
  }

  // Check if pair already exists
  const existingPair = await db
    .prepare(
      `SELECT id FROM pairs
       WHERE (user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?)`
    )
    .bind(invite.from_user_id, user.id, user.id, invite.from_user_id)
    .first();

  if (existingPair) {
    redirect("/dashboard");
  }

  // Accept the invite and create the pair
  const pairId = generateId();
  await db
    .prepare("INSERT INTO pairs (id, user_a_id, user_b_id) VALUES (?, ?, ?)")
    .bind(pairId, invite.from_user_id, user.id)
    .run();

  await db
    .prepare("UPDATE invites SET accepted_by_user_id = ? WHERE id = ?")
    .bind(user.id, invite.id)
    .run();

  redirect("/dashboard");
}
