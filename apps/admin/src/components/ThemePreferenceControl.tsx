"use client";

import { useTheme, type ThemePreference } from "@/components/ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemePreferenceControl({
  className = "",
}: {
  className?: string;
}) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={`theme-pref ${className}`.trim()}
      role="group"
      aria-label="Appearance"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={preference === opt.value ? "active" : undefined}
          aria-pressed={preference === opt.value}
          onClick={() => setPreference(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
