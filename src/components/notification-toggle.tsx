"use client";

import { useState, useEffect, useCallback } from "react";

interface NotificationSetting {
  new_waffle: number;
  comments: number;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs text-waffle-dark/70">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={`relative h-5 w-8 rounded-full transition-colors ${
          checked ? "bg-waffle" : "bg-waffle-light/40"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-3" : ""
          }`}
        />
      </button>
    </label>
  );
}

export function InlineNotificationSettings({
  targetType,
  targetId,
}: {
  targetType: "pair" | "circle";
  targetId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [setting, setSetting] = useState<NotificationSetting | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/notifications");
      if (res.ok) {
        const data = await res.json();
        const match = data.find(
          (s: { target_type: string; target_id: string | null }) =>
            s.target_type === targetType && s.target_id === targetId
        );
        const global = data.find(
          (s: { target_type: string }) => s.target_type === "global"
        );
        if (match) {
          setSetting({ new_waffle: match.new_waffle, comments: match.comments });
        } else if (global) {
          setSetting({ new_waffle: global.new_waffle, comments: global.comments });
        } else {
          setSetting({ new_waffle: 1, comments: 1 });
        }
      }
    } catch {
      setSetting({ new_waffle: 1, comments: 1 });
    }
  }, [targetType, targetId]);

  useEffect(() => {
    if (expanded && !setting) load();
  }, [expanded, setting, load]);

  async function update(newWaffle: boolean, comments: boolean) {
    setLoading(true);
    setSetting({ new_waffle: newWaffle ? 1 : 0, comments: comments ? 1 : 0 });
    await fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        new_waffle: newWaffle,
        comments,
      }),
    });
    setLoading(false);
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-[11px] font-semibold text-waffle-dark/30 hover:text-waffle transition-colors"
        title="Notification settings"
      >
        Notifications
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-white/40 border border-waffle-light/30 px-3 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-waffle-dark/40">Notifications</span>
        <button onClick={() => setExpanded(false)} className="text-[10px] font-semibold text-waffle-dark/30 hover:text-waffle-dark/60">✕</button>
      </div>
      {setting ? (
        <div className={`space-y-1 ${loading ? "opacity-50" : ""}`}>
          <Toggle
            label="New waffles"
            checked={!!setting.new_waffle}
            onChange={(val) => update(val, !!setting.comments)}
          />
          <Toggle
            label="Comments"
            checked={!!setting.comments}
            onChange={(val) => update(!!setting.new_waffle, val)}
          />
        </div>
      ) : (
        <span className="text-[10px] text-waffle-dark/40">Loading...</span>
      )}
    </div>
  );
}
