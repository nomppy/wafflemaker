"use client";

import { useState } from "react";

export function EditName({ currentName }: { currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || name.trim() === currentName) {
      setEditing(false);
      setName(currentName);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/update-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name.trim() }),
    });
    if (res.ok) {
      window.location.reload();
    }
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-0.5 text-sm font-medium text-waffle-dark/70 hover:text-waffle transition-colors"
        title="Edit display name"
      >
        Hey, {currentName} <span className="text-xs opacity-50">&#9998;</span>
      </button>
    );
  }

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        maxLength={50}
        autoFocus
        className="w-32 rounded-lg border border-waffle-light/50 bg-white/50 px-2 py-0.5 text-sm text-waffle-dark outline-none focus:border-waffle"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-waffle px-2 py-0.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        onClick={() => { setEditing(false); setName(currentName); }}
        className="text-xs text-waffle-dark/40 hover:text-waffle-dark"
      >
        Cancel
      </button>
    </div>
  );
}
