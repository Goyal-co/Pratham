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
  const [showTip, setShowTip] = useState(false);

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
    const tipTimer = window.setTimeout(() => setShowTip(true), 1200);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(tipTimer);
    };
  }, []);

  if (hidden) return null;

  if (deferred) {
    return (
      <div className="auth-install admin">
        <div>
          <strong>Install Admin app</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Kitchen desk on your home screen.
          </p>
        </div>
        <button
          className="btn"
          type="button"
          style={{ width: "auto" }}
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
      <div className="auth-install admin">
        <div>
          <strong>Add to Home Screen</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Tap Share → Add to Home Screen.
          </p>
        </div>
      </div>
    );
  }

  if (showTip) {
    return (
      <div className="auth-install admin">
        <div>
          <strong>Installable desk</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Browser menu → Install app / Add to Home Screen.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
