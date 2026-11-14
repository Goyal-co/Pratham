"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/http";

const STATUSES = [
  "placed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export function OrderStatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        json: { status: value },
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <select value={value} onChange={(e) => setValue(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <button className="btn" disabled={busy || value === status} onClick={save}>
        Save
      </button>
    </div>
  );
}
