"use client";

import { useState } from "react";

export function InviteButton() {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/invites", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create invite.");
      setLoading(false);
      return;
    }
    setInviteUrl(data.url);
    setCopied(false);
    setLoading(false);
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  function inviteAnother() {
    setInviteUrl(null);
    setCopied(false);
    createInvite();
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
        {copied && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-waffle-dark/50">Link copied to clipboard</span>
            <button
              onClick={inviteAnother}
              disabled={loading}
              className="text-xs font-semibold text-waffle hover:text-syrup transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Invite another friend"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={createInvite}
        disabled={loading}
        className="btn-retro w-full py-3.5 text-base disabled:opacity-50"
      >
        {loading ? "Creating..." : "Invite a friend"}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
