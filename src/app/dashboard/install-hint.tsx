"use client";

import { useState, useEffect } from "react";

export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only show on iOS Safari, not already in standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    const dismissed = localStorage.getItem("waffle:install-hint-dismissed");
    if (isIOS && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("waffle:install-hint-dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-4 card-cottage bg-butter/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-syrup">
            Use Wafflemaker as an app
          </p>
          <p className="mt-1 text-xs leading-relaxed text-waffle-dark/70">
            Tap the share button in Safari, then &ldquo;Add to Home Screen&rdquo; for the full experience with notifications.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs font-semibold text-waffle-dark/30 hover:text-waffle-dark/60"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
