"use client";

import { useState, useCallback } from "react";

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
      <span className="text-sm text-waffle-dark/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full transition-colors ${
          checked ? "bg-waffle" : "bg-waffle-light/40"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}

export function SettingsView({
  settings: initialSettings,
  pairs,
  circles,
  hasExistingSubscription,
}: {
  settings: NotificationSetting[];
  pairs: Pair[];
  circles: Circle[];
  hasExistingSubscription: boolean;
}) {
  const [pushEnabled, setPushEnabled] = useState(hasExistingSubscription);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [settings, setSettings] = useState(initialSettings);

  function getSetting(targetType: string, targetId: string | null) {
    return settings.find(
      (s) => s.target_type === targetType && s.target_id === targetId
    );
  }

  function getEffective(targetType: string, targetId: string | null, field: "new_waffle" | "comments") {
    const specific = getSetting(targetType, targetId);
    if (specific) return !!specific[field];
    const global = getSetting("global", null);
    if (global) return !!global[field];
    return true; // default enabled
  }

  const updateSetting = useCallback(async (targetType: string, targetId: string | null, newWaffle: boolean, comments: boolean) => {
    // Optimistic update FIRST
    setSettings((prev) => {
      const existing = prev.findIndex(
        (s) => s.target_type === targetType && s.target_id === targetId
      );
      const entry: NotificationSetting = {
        target_type: targetType,
        target_id: targetId,
        new_waffle: newWaffle ? 1 : 0,
        comments: comments ? 1 : 0,
      };
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = entry;
        return copy;
      }
      return [...prev, entry];
    });
    // Fire-and-forget to server
    fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        new_waffle: newWaffle,
        comments,
      }),
    });
  }, []);

  async function enablePush() {
    setPushLoading(true);
    setPushError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("Notification permission was denied. Enable it in your browser settings.");
        setPushLoading(false);
        return;
      }

      // Fetch VAPID public key from server (not build-time env var, which may be missing on CF)
      const vapidRes = await fetch("/api/push/vapid-key");
      if (!vapidRes.ok) throw new Error("Could not fetch VAPID key");
      const { key: vapidPublicKey } = await vapidRes.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      const json = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });

      setPushEnabled(true);
    } catch (err) {
      setPushError("Failed to enable push notifications. Try again.");
      console.error("Push subscription error:", err);
    }
    setPushLoading(false);
  }

  async function disablePush() {
    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
    } catch {
      // Best effort
    }
    setPushLoading(false);
  }

  const globalNewWaffle = getEffective("global", null, "new_waffle");
  const globalComments = getEffective("global", null, "comments");

  return (
    <div className="space-y-6">
      {/* Push Notifications */}
      <section className="card-cottage p-5">
        <h2 className="font-display mb-3 text-lg font-bold text-syrup">Push Notifications</h2>
        {pushEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-waffle-dark/80">Notifications enabled</span>
            </div>
            <button
              onClick={disablePush}
              disabled={pushLoading}
              className="rounded-lg bg-waffle-light/30 px-4 py-2 text-sm font-semibold text-waffle-dark/70 transition-colors hover:bg-waffle-light/50 disabled:opacity-50"
            >
              {pushLoading ? "Disabling..." : "Disable Notifications"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-waffle-dark/60">
              Get notified when you receive new waffles or comments.
            </p>
            <button
              onClick={enablePush}
              disabled={pushLoading}
              className="rounded-lg bg-waffle px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-waffle/90 disabled:opacity-50"
            >
              {pushLoading ? "Enabling..." : "Enable Notifications"}
            </button>
          </div>
        )}
        {pushError && (
          <p className="mt-2 text-xs text-red-600">{pushError}</p>
        )}
      </section>

      {/* Global Defaults */}
      <section className="card-cottage p-5">
        <h2 className="font-display mb-3 text-lg font-bold text-syrup">Notification Defaults</h2>
        <div className="space-y-3">
          <Toggle
            label="New waffles"
            checked={globalNewWaffle}
            onChange={(val) => updateSetting("global", null, val, globalComments)}
          />
          <Toggle
            label="Comments on your waffles"
            checked={globalComments}
            onChange={(val) => updateSetting("global", null, globalNewWaffle, val)}
          />
        </div>
      </section>

      {/* Per-Pair Settings */}
      {pairs.length > 0 && (
        <section className="card-cottage p-5">
          <h2 className="font-display mb-3 text-lg font-bold text-syrup">Pair Notifications</h2>
          <p className="mb-3 text-xs text-waffle-dark/50">Override defaults for specific pairs.</p>
          <div className="space-y-4">
            {pairs.map((pair) => {
              const pairNewWaffle = getEffective("pair", pair.id, "new_waffle");
              const pairComments = getEffective("pair", pair.id, "comments");
              const hasOverride = !!getSetting("pair", pair.id);
              return (
                <div key={pair.id} className="rounded-lg bg-white/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-syrup">{pair.partner_name}</p>
                  <div className="space-y-2">
                    <Toggle
                      label="New waffles"
                      checked={pairNewWaffle}
                      onChange={(val) => updateSetting("pair", pair.id, val, pairComments)}
                    />
                    <Toggle
                      label="Comments"
                      checked={pairComments}
                      onChange={(val) => updateSetting("pair", pair.id, pairNewWaffle, val)}
                    />
                  </div>
                  {hasOverride && (
                    <p className="mt-1 text-[10px] text-waffle-dark/40">Custom override active</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Per-Circle Settings */}
      {circles.length > 0 && (
        <section className="card-cottage p-5">
          <h2 className="font-display mb-3 text-lg font-bold text-syrup">Circle Notifications</h2>
          <p className="mb-3 text-xs text-waffle-dark/50">Override defaults for specific circles.</p>
          <div className="space-y-4">
            {circles.map((circle) => {
              const circleNewWaffle = getEffective("circle", circle.id, "new_waffle");
              const circleComments = getEffective("circle", circle.id, "comments");
              const hasOverride = !!getSetting("circle", circle.id);
              return (
                <div key={circle.id} className="rounded-lg bg-white/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-syrup">{circle.name}</p>
                  <div className="space-y-2">
                    <Toggle
                      label="New waffles"
                      checked={circleNewWaffle}
                      onChange={(val) => updateSetting("circle", circle.id, val, circleComments)}
                    />
                    <Toggle
                      label="Comments"
                      checked={circleComments}
                      onChange={(val) => updateSetting("circle", circle.id, circleNewWaffle, val)}
                    />
                  </div>
                  {hasOverride && (
                    <p className="mt-1 text-[10px] text-waffle-dark/40">Custom override active</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
