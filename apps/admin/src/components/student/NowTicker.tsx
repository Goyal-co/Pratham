"use client";

import { useEffect, useState } from "react";

/** Updates `now` every 30s without forcing parent remount of heavy trees when isolated. */
export function useNowTicker(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
