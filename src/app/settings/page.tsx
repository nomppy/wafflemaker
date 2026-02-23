import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { SettingsView } from "./settings-view";

interface NotificationSetting {
  target_type: string;
  target_id: string | null;
  new_waffle: number;
  comments: number;
}

interface Pair {
  id: string;
  partner_name: string;
}

interface Circle {
  id: string;
  name: string;
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();

  const { results: settings } = await db
    .prepare("SELECT target_type, target_id, new_waffle, comments FROM notification_settings WHERE user_id = ?")
    .bind(user.id)
    .all<NotificationSetting>();

  const { results: pairs } = await db
    .prepare(
      `SELECT p.id,
              CASE WHEN p.user_a_id = ? THEN ub.display_name ELSE ua.display_name END as partner_name
       FROM pairs p
       JOIN users ua ON ua.id = p.user_a_id
       JOIN users ub ON ub.id = p.user_b_id
       WHERE p.user_a_id = ? OR p.user_b_id = ?`
    )
    .bind(user.id, user.id, user.id)
    .all<Pair>();

  const { results: circles } = await db
    .prepare(
      `SELECT c.id, c.name
       FROM circles c
       JOIN circle_members cm ON cm.circle_id = c.id
       WHERE cm.user_id = ?`
    )
    .bind(user.id)
    .all<Circle>();

  const hasSubscriptions = await db
    .prepare("SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?")
    .bind(user.id)
    .first<{ count: number }>();

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-butter text-syrup transition-colors hover:bg-butter-deep"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="font-display text-2xl font-bold text-syrup">Settings</h1>
      </div>

      <SettingsView
        settings={settings}
        pairs={pairs}
        circles={circles}
        hasExistingSubscription={(hasSubscriptions?.count || 0) > 0}
      />
    </main>
  );
}
