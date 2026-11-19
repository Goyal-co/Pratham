"use client";

import { ThemePreferenceControl } from "@/components/ThemePreferenceControl";

export function AppearanceSettings() {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Appearance</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Follows your device by default. Override with Light or Dark for this
        browser.
      </p>
      <ThemePreferenceControl />
    </div>
  );
}
