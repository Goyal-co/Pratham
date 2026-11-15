"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/http";

type Note = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function StudentNotificationsPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api<{ notifications: Note[] }>("/api/notifications");
    setNotes(data.notifications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function markRead(id: string) {
    await api("/api/notifications", {
      method: "PATCH",
      json: { id, read: true },
    });
    await load();
  }

  if (loading) {
    return (
      <div>
        <h1 className="student-title">Notifications</h1>
        <p className="student-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="student-title">Notifications</h1>
      <p className="student-muted">Menu, orders, and reminders</p>
      {!notes.length && <p className="student-muted">No notifications yet.</p>}
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          className="student-card"
          style={{
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            opacity: n.read_at ? 0.65 : 1,
          }}
          onClick={() => !n.read_at && markRead(n.id)}
        >
          <strong>{n.title}</strong>
          <div className="student-muted" style={{ marginBottom: 0 }}>
            {n.body}
          </div>
        </button>
      ))}
    </div>
  );
}
