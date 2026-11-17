"use client";

import { useEffect, useState } from "react";

const KEY = "ahariva_splash_seen";

/** Short branded splash on cold open / hard refresh (once per tab session). */
export function AppSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode — still show once this mount */
    }
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 1600);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="app-splash" role="presentation" aria-hidden>
      <div className="app-splash-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ahariva-logo.png"
          alt=""
          className="app-splash-logo"
          width={180}
          height={180}
        />
      </div>
    </div>
  );
}
