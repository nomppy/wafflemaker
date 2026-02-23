import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { PushHint } from "./push-hint";
import { InstallHint } from "./install-hint";
import { InviteButton } from "./invite-button";
import { CreateCircleButton } from "./create-circle-button";
import { LogoutButton } from "./logout-button";
import { getStreak } from "@/lib/streaks";
import { EditName } from "./edit-name";

interface Pair {
  id: string;
  partner_name: string;
  partner_email: string;
  streak: number;
}

interface Circle {
  id: string;
  name: string;
  member_count: number;
}

async function getUserPairs(userId: string): Promise<Pair[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT p.id,
              CASE WHEN p.user_a_id = ? THEN ub.display_name ELSE ua.display_name END as partner_name,
              CASE WHEN p.user_a_id = ? THEN ub.email ELSE ua.email END as partner_email
       FROM pairs p
       JOIN users ua ON ua.id = p.user_a_id
       JOIN users ub ON ub.id = p.user_b_id
       WHERE p.user_a_id = ? OR p.user_b_id = ?`
    )
    .bind(userId, userId, userId, userId)
    .all<Pair>();
  return results;
}

async function getUserCircles(userId: string): Promise<Circle[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name,
              (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
       FROM circles c
       JOIN circle_members cm ON cm.circle_id = c.id
       WHERE cm.user_id = ?`
    )
    .bind(userId)
    .all<Circle>();
  return results;
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

  const rawPairs = await getUserPairs(user.id);
  const pairs = await Promise.all(
    rawPairs.map(async (p) => ({
      ...p,
      streak: await getStreak(p.id, user.id),
    }))
  );
  const circles = await getUserCircles(user.id);

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-syrup">Your Waffles</h1>
          <EditName currentName={user.display_name} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-waffle-dark/40 transition-colors hover:bg-butter hover:text-syrup"
            title="Settings"
          >
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5 fill-current">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </Link>
          <LogoutButton />
        </div>
      </div>

      <InstallHint />
      <PushHint />
      <InviteButton />
      <CreateCircleButton />

      {/* Circles section */}
      {circles.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-syrup">Circles</h2>
          {circles.map((circle) => (
            <Link
              key={circle.id}
              href={`/circle/${circle.id}`}
              className="card-cottage block p-5 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-syrup">{circle.name}</p>
                  <p className="text-sm text-waffle-dark/60">
                    {circle.member_count} member{circle.member_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    {pairs.length === 0 && circles.length === 0 ? (
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
                <div>
                  <p className="font-display font-semibold text-syrup">{pair.partner_name}</p>
                  <p className="text-sm text-waffle-dark/60">{pair.partner_email}</p>
                </div>
                {pair.streak > 0 && (
                  <span className="counter-retro">
                    {String(pair.streak).padStart(3, "0")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      <footer className="mt-12 border-t border-dashed border-waffle-light/40 pt-4 pb-2 text-center text-xs text-waffle-dark/30">
        <a href="https://github.com/nomppy/wafflemaker" className="hover:text-waffle-dark/50 transition-colors">GitHub</a>
        {" "}&bull;{" "}
        <a href="mailto:feedback@sunken.site?subject=Wafflemaker%20Feedback" className="hover:text-waffle-dark/50 transition-colors">Feedback</a>
      </footer>
    </main>
  );
}
