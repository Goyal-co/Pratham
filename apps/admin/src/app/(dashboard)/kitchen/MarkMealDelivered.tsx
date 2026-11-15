"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/http";

export function MarkMealDelivered({
  date,
  meal,
  count,
}: {
  date: string;
  meal: "breakfast" | "lunch" | "dinner";
  count: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = meal[0].toUpperCase() + meal.slice(1);

  if (!count) {
    return (
      <button className="btn secondary" type="button" disabled>
        {label} · none open
      </button>
    );
  }

  return (
    <button
      className="btn"
      type="button"
      disabled={busy}
      onClick={async () => {
        if (
          !confirm(
            `Mark all ${count} open ${label.toLowerCase()} order(s) as delivered for ${date}? COD will be charged.`
          )
        ) {
          return;
        }
        setBusy(true);
        try {
          const data = await api<{ delivered: number }>("/api/orders/bulk-deliver", {
            method: "POST",
            json: { date, meal_type: meal },
          });
          alert(`Delivered ${data.delivered} ${label.toLowerCase()} order(s).`);
          router.refresh();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : `Deliver all ${label} (${count})`}
    </button>
  );
}
