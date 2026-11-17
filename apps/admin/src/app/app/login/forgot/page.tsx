"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/http";
import { AharivaLogo } from "@/components/student/AharivaLogo";
import { studentHref, useStudentBase } from "@/lib/student-paths";

export default function StudentForgotPasswordPage() {
  const base = useStudentBase();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const data = await api<{
        ok: boolean;
        message?: string;
      }>("/api/auth/forgot-password", {
        method: "POST",
        json: { email, phone },
      });
      setDone(
        data.message ||
          "If an account matches, we sent a password reset link to that email."
      );
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth-student">
      <div className="auth-student-hero">
        <p className="auth-eyebrow">Breakfast · Lunch · Dinner</p>
        <AharivaLogo variant="full" height={56} className="auth-brand-logo" />
        <p className="auth-tagline">
          We email a reset link after email + phone match.
        </p>
      </div>

      <form className="auth-student-card" onSubmit={onSubmit}>
        <h2 className="auth-form-title">Forgot password</h2>
        {done ? (
          <>
            <p className="student-muted" style={{ marginBottom: 16 }}>
              {done}
            </p>
            <Link className="student-btn" href={studentHref(base, "/login")}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="student-muted">
              Use the phone number from your signup. The reset link is sent to
              your email only.
            </p>
            <label className="student-field">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="student-field">
              Phone
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="Registered mobile"
              />
            </label>
            {error && (
              <p style={{ color: "var(--s-danger)", marginBottom: 12 }}>
                {error}
              </p>
            )}
            <button className="student-btn" disabled={busy} type="submit">
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <Link className="student-link" href={studentHref(base, "/login")}>
              Back to sign in
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
