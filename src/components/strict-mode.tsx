"use client";

import { useState, useEffect, useCallback } from "react";

interface StrictStatus {
  strictActive: boolean;
  myVote: number | null;
  optedInCount: number;
  memberCount: number;
  allOptedIn: boolean;
}

export function StrictModeToggle({
  targetType,
  targetId,
}: {
  targetType: "pair" | "circle";
  targetId: string;
}) {
  const [status, setStatus] = useState<StrictStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/strict-mode?type=${targetType}&id=${targetId}`);
      if (res.ok) setStatus(await res.json());
    } catch { /* noop */ }
  }, [targetType, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  async function vote(v: number) {
    setLoading(true);
    await fetch("/api/strict-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: targetType, id: targetId, vote: v }),
    });
    await load();
    setLoading(false);
  }

  if (!status) return null;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`text-[11px] font-semibold transition-colors ${
          status.strictActive
            ? "text-waffle hover:text-syrup"
            : "text-waffle-dark/30 hover:text-waffle"
        }`}
      >
        {status.strictActive ? "Strict mode on" : "Strict mode"}
      </button>
    );
  }

  const iOptedIn = status.myVote === 1;

  return (
    <div className="rounded-lg bg-white/40 border border-waffle-light/30 px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-waffle-dark/40">Strict Mode</span>
        <button onClick={() => setExpanded(false)} className="text-[10px] font-semibold text-waffle-dark/30 hover:text-waffle-dark/60">✕</button>
      </div>
      <p className="text-[11px] leading-relaxed text-waffle-dark/60">
        {status.strictActive
          ? "Waffles can only be sent on Wednesdays. All members opted in."
          : "When all members opt in, waffles can only be sent on Wednesdays. Any member can disable it."}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-waffle-dark/50">
          {status.optedInCount}/{status.memberCount} opted in
        </span>
        {status.strictActive && (
          <span className="rounded-full bg-waffle/10 px-1.5 py-0.5 text-[9px] font-bold text-waffle">Active</span>
        )}
      </div>
      <button
        onClick={() => vote(iOptedIn ? 0 : 1)}
        disabled={loading}
        className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          iOptedIn
            ? "bg-waffle-light/30 text-waffle-dark/60 hover:bg-red-50 hover:text-red-600"
            : "bg-waffle text-white hover:bg-waffle/90"
        }`}
      >
        {loading ? "..." : iOptedIn ? "Opt out" : "Opt in"}
      </button>
    </div>
  );
}
