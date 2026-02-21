export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { InviteButton } from "./invite-button";
import { LogoutButton } from "./logout-button";
import { getStreak } from "@/lib/streaks";

interface Pair {
  id: string;
  partner_name: string;
  partner_email: string;
  streak: number;
}

function getUserPairs(userId: string): Pair[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.id,
              CASE WHEN p.user_a_id = ? THEN ub.display_name ELSE ua.display_name END as partner_name,
              CASE WHEN p.user_a_id = ? THEN ub.email ELSE ua.email END as partner_email
       FROM pairs p
       JOIN users ua ON ua.id = p.user_a_id
       JOIN users ub ON ub.id = p.user_b_id
       WHERE p.user_a_id = ? OR p.user_b_id = ?`
    )
    .all(userId, userId, userId, userId) as Pair[];
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pairs = getUserPairs(user.id).map((p) => ({
    ...p,
    streak: getStreak(p.id, user.id),
  }));

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-900">Your Waffles</h1>
          <p className="text-sm text-amber-600">Hey, {user.display_name}</p>
        </div>
        <LogoutButton />
      </div>

      <InviteButton />

      {pairs.length === 0 ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl bg-amber-100 p-6 text-center">
            <p className="mb-2 text-lg font-medium text-amber-900">
              Welcome to Wednesday Waffles!
            </p>
            <p className="text-sm text-amber-800">
              This is where you&apos;ll see your waffle pairs. To get started,
              invite a friend using the button above. Share the link with them
              and once they sign up, you&apos;ll be connected.
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-sm font-semibold text-amber-700">How it works:</p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>1. Invite a friend with a shareable link</li>
              <li>2. Every Wednesday, record a voice message for each other</li>
              <li>3. Listen and reply on your own time - no rush</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {pairs.map((pair) => (
            <Link
              key={pair.id}
              href={`/pair/${pair.id}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-amber-900">{pair.partner_name}</p>
                {pair.streak > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {pair.streak}w streak
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{pair.partner_email}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
