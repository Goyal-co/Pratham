"use client";

import { BRAND } from "@/lib/brand";

/** Static brand mark (kept name for existing imports). */
export function RotatingBrand({
  className = "auth-brand",
}: {
  className?: string;
  intervalMs?: number;
}) {
  return <h1 className={className}>{BRAND}</h1>;
}

export function RotatingBrandInline({ className }: { className?: string; intervalMs?: number }) {
  return <span className={className}>{BRAND}</span>;
}
