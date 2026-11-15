"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function AdminPwa() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    navigator.serviceWorker?.register("/admin-sw.js").catch(() => undefined);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      navigator.standalone === true;
    if (standalone) {
      setHidden(true);
      return;
    }

    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) setIos(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden) return null;

  if (deferred) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <strong>Install Admin app</strong>
        <p className="muted" style={{ marginBottom: 10 }}>
          Add the kitchen desk to your home screen for quick access.
        </p>
        <button
          className="btn"
          type="button"
          onClick={async () => {
            await deferred.prompt();
            setDeferred(null);
            setHidden(true);
          }}
        >
          Install
        </button>
      </div>
    );
  }

  if (ios) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <strong>Add to Home Screen</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          Tap Share → Add to Home Screen to install Pratham Admin.
        </p>
      </div>
    );
  }

  return null;
}
