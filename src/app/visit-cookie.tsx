"use client";

import { useEffect } from "react";

export function VisitCookie() {
  useEffect(() => {
    if (!document.cookie.includes("visited=1")) {
      document.cookie = "visited=1; path=/; max-age=86400; samesite=lax";
    }
  }, []);
  return null;
}
