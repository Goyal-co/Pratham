"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

export default function StudentSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    hostel: "",
    room: "",
    referral_code: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        json: {
          ...form,
          email: form.email.trim().toLowerCase(),
          referral_code: form.referral_code.trim(),
        },
      });
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setBusy(false);
    }
  }

  return (
    <form className="student-card" onSubmit={onSubmit}>
      <h1 className="student-title">Join Pratham</h1>
      <p className="student-muted">
        Optional invite code unlocks referral rewards for your friend.
      </p>
      {(
        [
          ["full_name", "Full name", "text"],
          ["email", "Email", "email"],
          ["password", "Password", "password"],
          ["phone", "Phone", "tel"],
          ["hostel", "Hostel", "text"],
          ["room", "Room", "text"],
          ["referral_code", "Referral code (optional)", "text"],
        ] as const
      ).map(([key, label, type]) => (
        <label className="student-field" key={key}>
          {label}
          <input
            type={type}
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            required={key !== "referral_code"}
          />
        </label>
      ))}
      {error && (
        <p style={{ color: "var(--s-danger)", marginBottom: 12 }}>{error}</p>
      )}
      <button className="student-btn" disabled={busy} type="submit">
        {busy ? "Creating…" : "Create account"}
      </button>
      <Link className="student-link" href="/app/login">
        Already have an account? Sign in
      </Link>
    </form>
  );
}
