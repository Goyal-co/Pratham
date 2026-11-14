"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/http";

export function GeneratePlansButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const data = await api<{ created: number }>("/api/plans/generate", {
        method: "POST",
        json: {},
      });
      alert(`Generated ${data.created ?? 0} fixed-plan orders`);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn secondary" disabled={busy} onClick={run}>
      {busy ? "Generating…" : "Generate fixed-plan orders"}
    </button>
  );
}
