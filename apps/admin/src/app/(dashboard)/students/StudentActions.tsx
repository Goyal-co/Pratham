"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/http";

export function StudentActions({
  studentId,
  creditLimit,
  outstanding,
}: {
  studentId: string;
  creditLimit: number;
  outstanding: number;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(String(creditLimit));
  const [busy, setBusy] = useState(false);

  async function saveLimit() {
    setBusy(true);
    try {
      await api(`/api/students/${studentId}/credit-limit`, {
        method: "PATCH",
        json: { credit_limit: Number(limit) },
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearBalance() {
    const note = prompt("Collection note (optional)", "COD collected") ?? undefined;
    setBusy(true);
    try {
      await api(`/api/students/${studentId}/balance`, {
        method: "PATCH",
        json: { new_balance: 0, note },
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
      <div className="row">
        <input
          style={{ width: 90 }}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
        <button className="btn secondary" disabled={busy} onClick={saveLimit}>
          Set limit
        </button>
      </div>
      <button
        className="btn"
        disabled={busy || outstanding <= 0}
        onClick={clearBalance}
      >
        Clear balance to 0
      </button>
    </div>
  );
}
