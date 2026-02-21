"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateCircleButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createCircle() {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/circles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setName("");
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  if (open) {
    return (
      <div className="card-cottage bg-waffle-texture p-5">
        <p className="font-display mb-2 text-sm font-semibold text-syrup">
          Name your waffle circle:
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCircle()}
            placeholder="e.g. Family Waffles"
            className="input-cottage flex-1 text-sm"
            autoFocus
          />
          <button
            onClick={createCircle}
            disabled={loading || !name.trim()}
            className="btn-retro px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="mt-2 text-xs font-bold text-waffle-dark/40 hover:text-waffle-dark"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="btn-retro w-full py-3.5 text-base mt-2"
    >
      Create a waffle circle
    </button>
  );
}
