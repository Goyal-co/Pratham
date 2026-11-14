"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

export function PublishMenuButton({ date }: { date: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function publish(notify: boolean) {
    setBusy(true);
    try {
      const res = await api<{
        summary: string;
        notify: { recipients: number };
      }>("/api/menu/publish", {
        method: "POST",
        json: { date, notify },
      });
      alert(
        notify
          ? `Published & notified ${res.notify?.recipients ?? 0} students.\n${res.summary}`
          : `Published without push.\n${res.summary}`
      );
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      <button
        className="btn"
        disabled={busy}
        onClick={() => publish(true)}
        type="button"
      >
        {busy ? "Working…" : "Publish & notify students"}
      </button>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={() => publish(false)}
        type="button"
      >
        Publish only
      </button>
    </div>
  );
}
