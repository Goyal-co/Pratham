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
  const [showTip, setShowTip] = useState(false);

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
    const tipTimer = window.setTimeout(() => setShowTip(true), 1200);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(tipTimer);
    };
  }, []);

  if (hidden) return null;

  if (deferred) {
    return (
      <div className="auth-install">
        <div>
          <strong>Install Rotatinal</strong>
          <p className="student-muted" style={{ marginBottom: 0 }}>
            Home-screen app for breakfast, lunch & dinner orders.
          </p>
        </div>
        <button
          className="student-btn"
          style={{ width: "auto", minWidth: 110 }}
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
      <div className="auth-install">
        <div>
          <strong>Add to Home Screen</strong>
          <p className="student-muted" style={{ marginBottom: 0 }}>
            Tap Share → <em>Add to Home Screen</em> to install.
          </p>
        </div>
      </div>
    );
  }

  if (showTip) {
    return (
      <div className="auth-install">
        <div>
          <strong>Installable app</strong>
          <p className="student-muted" style={{ marginBottom: 0 }}>
            Use your browser menu → <em>Install app</em> / Add to Home Screen.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
