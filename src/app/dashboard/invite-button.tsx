"use client";

import { useState } from "react";

export function InviteButton() {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createInvite() {
    setLoading(true);
    const res = await fetch("/api/invites", { method: "POST" });
    const data = await res.json();
    setInviteUrl(data.url);
    setLoading(false);
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (inviteUrl) {
    return (
      <div className="rounded-xl bg-amber-100 p-4">
        <p className="mb-2 text-sm font-medium text-amber-800">
          Share this link with your friend:
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={copyLink}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={createInvite}
      disabled={loading}
      className="w-full rounded-xl bg-amber-600 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
    >
      {loading ? "Creating..." : "Invite a friend"}
    </button>
  );
}
