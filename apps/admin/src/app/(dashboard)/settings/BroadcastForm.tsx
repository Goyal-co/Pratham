"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/http";

export function BroadcastForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const json = await api<{ recipients: number; pushes: number }>(
        "/api/push/broadcast",
        { method: "POST", json: { title, body } }
      );
      alert(`Sent to ${json.recipients} students (${json.pushes} devices)`);
      setTitle("");
      setBody("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="field">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        Message
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
      </label>
      <button className="btn" disabled={busy}>
        Send broadcast
      </button>
    </form>
  );
}
