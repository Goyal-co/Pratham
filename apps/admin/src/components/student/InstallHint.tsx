"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [hidden, setHidden] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS safari
      navigator.standalone === true;
    if (isStandalone) {
      setHidden(true);
      return;
    }
    if (isIos) setIos(true);

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
      <div className="student-card">
        <strong>Install Pratham</strong>
        <p className="student-muted">Add to your home screen for quick orders.</p>
        <button
          className="student-btn"
          type="button"
          onClick={async () => {
            await deferred.prompt();
            setDeferred(null);
            setHidden(true);
          }}
        >
          Install app
        </button>
      </div>
    );
  }

  if (ios) {
    return (
      <div className="student-card">
        <strong>Add to Home Screen</strong>
        <p className="student-muted" style={{ marginBottom: 0 }}>
          Tap Share → <em>Add to Home Screen</em> to install Pratham.
        </p>
      </div>
    );
  }

  return null;
}
