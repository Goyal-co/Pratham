"use client";

import { useEffect, useState } from "react";

const WORDS = ["tiffin", "breakfast", "lunch", "dinner"] as const;

export function RotatingBrand({
  className = "auth-brand",
  intervalMs = 1000,
}: {
  className?: string;
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setI((n) => (n + 1) % WORDS.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  const word = WORDS[i];

  return (
    <h1 className={className} aria-live="polite" aria-label="tiffin breakfast lunch dinner">
      <span className="brand-rotate" key={word}>
        {word}
      </span>
    </h1>
  );
}

export function RotatingBrandInline({
  className,
  intervalMs = 1000,
}: {
  className?: string;
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setI((n) => (n + 1) % WORDS.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return (
    <span className={className} aria-live="polite">
      <span className="brand-rotate" key={WORDS[i]}>
        {WORDS[i]}
      </span>
    </span>
  );
}
