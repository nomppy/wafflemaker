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
      <div className="card-cottage bg-waffle-texture p-5">
        <p className="font-display mb-2 text-sm font-semibold text-syrup">
          Share this link with your friend:
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="input-cottage flex-1 text-sm"
          />
          <button
            onClick={copyLink}
            className="btn-retro px-5 py-2.5 text-sm"
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
      className="btn-retro w-full py-3.5 text-base disabled:opacity-50"
    >
      {loading ? "Creating..." : "Invite a friend"}
    </button>
  );
}
