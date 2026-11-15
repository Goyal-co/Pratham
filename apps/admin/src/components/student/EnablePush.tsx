"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureSubscription() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push is not configured (missing VAPID public key).");

  const reg = await navigator.serviceWorker.register("/app/sw.js", {
    scope: "/app",
  });
  await navigator.serviceWorker.ready;

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

export function EnablePush() {
  const [status, setStatus] = useState<
    "idle" | "on" | "off" | "unsupported" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await navigator.serviceWorker.register("/app/sw.js", { scope: "/app" });
        if (Notification.permission === "granted") {
          await ensureSubscription();
          if (!cancelled) setStatus("on");
          return;
        }
        if (!cancelled) setStatus("off");
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("off");
        return;
      }
      await ensureSubscription();
      setStatus("on");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not enable notifications");
    }
  }

  if (status === "unsupported" || status === "idle" || status === "on") {
    return null;
  }

  return (
    <div className="student-card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <strong>Enable notifications</strong>
        <div className="student-muted" style={{ margin: 0 }}>
          {error || "Menu updates and order open/close reminders."}
        </div>
      </div>
      <button className="student-btn" style={{ width: "auto" }} onClick={enable} type="button">
        {status === "error" ? "Retry" : "Allow"}
      </button>
    </div>
  );
}
