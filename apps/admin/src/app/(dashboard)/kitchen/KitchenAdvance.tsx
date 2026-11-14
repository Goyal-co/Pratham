"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/http";

const NEXT: Record<string, string | null> = {
  placed: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

export function KitchenAdvance({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = NEXT[status] ?? null;

  if (!next) {
    return <span className="muted">Done</span>;
  }

  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/orders/${orderId}/status`, {
            method: "PATCH",
            json: { status: next },
          });
          router.refresh();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      → {next.replaceAll("_", " ")}
    </button>
  );
}
