"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function PushHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 card-cottage bg-butter/50 p-4">
      <p className="text-sm text-waffle-dark/80">
        <span className="font-semibold text-syrup">Stay in the loop</span> — enable push notifications so you know when someone sends you a waffle.
      </p>
      <Link
        href="/settings"
        className="mt-2 inline-block text-xs font-semibold text-waffle hover:text-syrup"
      >
        Turn on in Settings →
      </Link>
    </div>
  );
}
