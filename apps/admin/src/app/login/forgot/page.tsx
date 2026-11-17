"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/http";
import { RotatingBrand } from "@/components/RotatingBrand";

export default function AdminForgotPasswordPage() {
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
    <main className="auth-admin">
      <section className="auth-admin-panel">
        <div className="auth-admin-panel-inner">
          <header className="auth-admin-brand">
            <p className="auth-eyebrow">Kitchen desk</p>
            <RotatingBrand className="auth-brand" />
            <p className="auth-tagline">Reset your staff password.</p>
          </header>

          <form className="auth-admin-card" onSubmit={onSubmit}>
            <div className="auth-admin-card-head">
              <h2 className="auth-form-title">Forgot password</h2>
              <p className="auth-form-sub">
                We email a one-time reset link. If a phone is on the account,
                include it to verify.
              </p>
            </div>
            {done ? (
              <>
                <p className="auth-form-sub" style={{ marginBottom: 16 }}>
                  {done}
                </p>
                <Link
                  href="/login"
                  className="btn auth-admin-submit"
                  style={{ display: "block", textAlign: "center" }}
                >
                  Back to sign in
                </Link>
              </>
            ) : (
              <>
                <label className="field">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </label>
                <label className="field">
                  Phone (if registered)
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="Optional if no phone on file"
                  />
                </label>
                {error && <p className="auth-error">{error}</p>}
                <button className="btn auth-admin-submit" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </button>
                <Link
                  href="/login"
                  className="auth-inline-link"
                  style={{
                    display: "block",
                    textAlign: "center",
                    marginTop: 14,
                  }}
                >
                  Back to sign in
                </Link>
              </>
            )}
          </form>
        </div>
      </section>
      <aside className="auth-admin-visual" aria-hidden>
        <div className="auth-admin-visual-inner" style={{ marginTop: "auto" }}>
          <span>Security</span>
          <strong>Password reset</strong>
          <p>Links expire in 30 minutes and can be used once.</p>
        </div>
      </aside>
    </main>
  );
}
