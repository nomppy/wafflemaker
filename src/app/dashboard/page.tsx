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

function EmptyPlateIcon() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="mx-auto mb-4 w-24 opacity-60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Plate */}
      <ellipse cx="40" cy="54" rx="34" ry="10" fill="#f5e6d0" stroke="#d4b896" strokeWidth="1.5" />
      <ellipse cx="40" cy="52" rx="30" ry="8" fill="white" stroke="#e8c47a" strokeWidth="2" strokeDasharray="4 3" />
      {/* Fork */}
      <line x1="18" y1="24" x2="18" y2="48" stroke="#c8913a" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="14" y1="24" x2="14" y2="32" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="18" y1="24" x2="18" y2="32" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="22" y1="24" x2="22" y2="32" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Knife */}
      <line x1="62" y1="24" x2="62" y2="48" stroke="#c8913a" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M62 24 C66 26 66 30 62 32" stroke="#c8913a" strokeWidth="1.5" fill="none" opacity="0.3" />
      {/* Question mark on plate */}
      <text x="40" y="50" textAnchor="middle" fontSize="16" fill="#c8913a" opacity="0.4" fontFamily="Fredoka">?</text>
    </svg>
  );
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
          <h1 className="font-display text-2xl font-bold text-syrup">Your Waffles</h1>
          <p className="mt-0.5 text-sm font-medium text-waffle-dark/70">Hey, {user.display_name} 👋</p>
        </div>
        <LogoutButton />
      </div>

      <InviteButton />

      {pairs.length === 0 ? (
        <div className="mt-8 space-y-4">
          <div className="card-cottage bg-waffle-texture p-7 text-center">
            <EmptyPlateIcon />
            <p className="font-display mb-2 text-lg font-semibold text-syrup">
              Your waffle plate is empty!
            </p>
            <p className="text-sm leading-relaxed text-waffle-dark/80">
              This is where you&apos;ll see your waffle pairs. To get started,
              invite a friend using the button above. Share the link with them
              and once they sign up, you&apos;ll be connected.
            </p>
          </div>
          <div className="card-cottage p-5">
            <p className="font-display mb-2 text-sm font-semibold text-syrup">How it works:</p>
            <ul className="space-y-1.5 text-sm text-waffle-dark/80">
              <li className="flex items-start gap-2">
                <span className="counter-retro shrink-0 text-xs">01</span>
                <span>Invite a friend with a shareable link</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="counter-retro shrink-0 text-xs">02</span>
                <span>Every Wednesday, record a voice message for each other</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="counter-retro shrink-0 text-xs">03</span>
                <span>Listen and reply on your own time &mdash; no rush</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {pairs.map((pair) => (
            <Link
              key={pair.id}
              href={`/pair/${pair.id}`}
              className="card-cottage block p-5 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-butter text-lg shadow-sm">
                    🧇
                  </div>
                  <div>
                    <p className="font-display font-semibold text-syrup">{pair.partner_name}</p>
                    <p className="text-sm text-waffle-dark/60">{pair.partner_email}</p>
                  </div>
                </div>
                {pair.streak > 0 && (
                  <span className="counter-retro">
                    🧇 {String(pair.streak).padStart(3, "0")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
