"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";
import { InstallHint } from "@/components/student/InstallHint";
import { studentHref, useStudentBase } from "@/lib/student-paths";

export default function StudentSignupPage() {
  const router = useRouter();
  const base = useStudentBase();
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
      router.push(studentHref(base));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth-student">
      <div className="auth-student-hero">
        <p className="auth-eyebrow">Join the kitchen</p>
        <h1 className="auth-brand">Pratham</h1>
        <p className="auth-tagline">
          Create your account, set hostel details, and start ordering COD meals.
        </p>
      </div>

      <InstallHint />

      <form className="auth-student-card" onSubmit={onSubmit}>
        <h2 className="auth-form-title">Create account</h2>
        <p className="student-muted">
          Optional invite code unlocks referral rewards for your friend.
        </p>
        {(
          [
            ["full_name", "Full name", "text", "Your name"],
            ["email", "Email", "email", "you@college.edu"],
            ["password", "Password", "password", "At least 6 characters"],
            ["phone", "Phone", "tel", "10-digit mobile"],
            ["hostel", "Hostel", "text", "Hostel / PG name"],
            ["room", "Room", "text", "Room no."],
            ["referral_code", "Referral code (optional)", "text", "Friend’s code"],
          ] as const
        ).map(([key, label, type, placeholder]) => (
          <label className="student-field" key={key}>
            {label}
            <input
              type={type}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              required={key !== "referral_code"}
              placeholder={placeholder}
              autoComplete={
                key === "email"
                  ? "email"
                  : key === "password"
                    ? "new-password"
                    : key === "full_name"
                      ? "name"
                      : key === "phone"
                        ? "tel"
                        : "off"
              }
            />
          </label>
        ))}
        {error && (
          <p style={{ color: "var(--s-danger)", marginBottom: 12 }}>{error}</p>
        )}
        <button className="student-btn" disabled={busy} type="submit">
          {busy ? "Creating…" : "Create account"}
        </button>
        <Link className="student-link" href={studentHref(base, "/login")}>
          Already have an account? Sign in
        </Link>
      </form>
    </div>
  );
}
