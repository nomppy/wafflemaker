"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <button
      onClick={handleLogout}
      className="btn-retro-cream btn-retro px-4 py-1.5 text-sm"
    >
      Sign out
    </button>
  );
}
