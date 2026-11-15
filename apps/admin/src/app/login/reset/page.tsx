"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/http";
import { RotatingBrand } from "@/components/RotatingBrand";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        json: { token, password },
      });
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-admin-card">
        <h2 className="auth-form-title">Invalid link</h2>
        <p className="auth-form-sub">This reset link is missing a token.</p>
        <Link href="/login/forgot" className="auth-inline-link">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-admin-card" onSubmit={onSubmit}>
      <div className="auth-admin-card-head">
        <h2 className="auth-form-title">Set new password</h2>
        <p className="auth-form-sub">Choose a password with at least 6 characters.</p>
      </div>
      <label className="field">
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        Confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button className="btn auth-admin-submit" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </button>
      <Link
        href="/login"
        className="auth-inline-link"
        style={{ display: "block", textAlign: "center", marginTop: 14 }}
      >
        Back to sign in
      </Link>
    </form>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <main className="auth-admin">
      <section className="auth-admin-panel">
        <div className="auth-admin-panel-inner">
          <header className="auth-admin-brand">
            <p className="auth-eyebrow">Kitchen desk</p>
            <RotatingBrand className="auth-brand" />
          </header>
          <Suspense fallback={<div className="auth-admin-card">Loading…</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </section>
      <aside className="auth-admin-visual" aria-hidden />
    </main>
  );
}
