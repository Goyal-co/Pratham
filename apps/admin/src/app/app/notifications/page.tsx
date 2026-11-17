"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/http";
import {
  getStudentSwRegistration,
  registerStudentSw,
} from "@/lib/student-sw";

type Note = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function enablePush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push is not configured yet.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Notifications are not supported in this browser.");
  }

  const reg = await registerStudentSw();
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("Permission denied — enable notifications in browser settings.");
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api("/api/push/register", {
    method: "POST",
    json: { subscription: sub.toJSON(), platform: "web" },
  });
}

async function disablePush() {
  if ("serviceWorker" in navigator) {
    const reg = await getStudentSwRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/register", {
        method: "DELETE",
        json: { subscription: sub.toJSON() },
      }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
  }
  await api("/api/push/register", {
    method: "DELETE",
    json: { all: true },
  });
}

export default function StudentNotificationsPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const load = useCallback(async () => {
    try {
      const [notesData, pushData] = await Promise.all([
        api<{ notifications: Note[] }>("/api/notifications").catch(() => ({
          notifications: [] as Note[],
        })),
        api<{ enabled: boolean }>("/api/push/register").catch(() => ({
          enabled: false,
        })),
      ]);
      setNotes(notesData.notifications ?? []);
      setPushOn(!!pushData.enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSupported("Notification" in window && "serviceWorker" in navigator);
    }
    load().catch(() => setLoading(false));
  }, [load]);

  async function markRead(id: string) {
    await api("/api/notifications", {
      method: "PATCH",
      json: { id, read: true },
    });
    await load();
  }

  async function togglePush() {
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        setPushMsg("Notifications turned off");
      } else {
        await enablePush();
        setPushOn(true);
        setPushMsg("Notifications turned on");
      }
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : "Could not update notifications");
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="v2-page-title">Notifications</h1>
        <div className="student-skeleton" style={{ height: 100 }} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="v2-page-title">Notifications</h1>
      <p className="v2-page-sub">Menu, orders, and reminders</p>

      <section className="student-panel">
        <div className="student-panel-body v2-notif-toggle">
          <div>
            <strong>Push notifications</strong>
            <p className="student-panel-note" style={{ margin: "4px 0 0" }}>
              {supported
                ? "Menu drops, order updates, and cutoff reminders."
                : "Not supported in this browser."}
            </p>
          </div>
          <button
            type="button"
            className={`v2-switch${pushOn ? " on" : ""}`}
            role="switch"
            aria-checked={pushOn}
            disabled={pushBusy || !supported}
            onClick={togglePush}
          >
            <span className="v2-switch-knob" />
            <span className="v2-switch-label">{pushOn ? "On" : "Off"}</span>
          </button>
        </div>
        {pushMsg && (
          <div className="student-panel-body" style={{ paddingTop: 0 }}>
            <div className="student-banner info">{pushMsg}</div>
          </div>
        )}
      </section>

      {!notes.length && (
        <p className="student-empty">No notifications yet.</p>
      )}
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
          <div className="student-muted" style={{ marginTop: 6, fontSize: "0.75rem" }}>
            {new Date(n.created_at).toLocaleString("en-IN")}
          </div>
        </button>
      ))}
    </div>
  );
}
