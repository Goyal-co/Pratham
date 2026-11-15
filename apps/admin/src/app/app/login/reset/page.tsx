"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/http";
import { RotatingBrand } from "@/components/RotatingBrand";
import { studentHref, useStudentBase } from "@/lib/student-paths";

function ResetForm() {
  const router = useRouter();
  const base = useStudentBase();
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
      router.push(studentHref(base, "/login"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-student-card">
        <h2 className="auth-form-title">Invalid link</h2>
        <p className="student-muted">This reset link is missing a token.</p>
        <Link className="student-link" href={studentHref(base, "/login/forgot")}>
          Request a new reset
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-student-card" onSubmit={onSubmit}>
      <h2 className="auth-form-title">Set new password</h2>
      <p className="student-muted">At least 6 characters.</p>
      <label className="student-field">
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
      <label className="student-field">
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
      {error && (
        <p style={{ color: "var(--s-danger)", marginBottom: 12 }}>{error}</p>
      )}
      <button className="student-btn" disabled={busy} type="submit">
        {busy ? "Saving…" : "Update password"}
      </button>
      <Link className="student-link" href={studentHref(base, "/login")}>
        Back to sign in
      </Link>
    </form>
  );
}

export default function StudentResetPasswordPage() {
  return (
    <div className="auth-student">
      <div className="auth-student-hero">
        <p className="auth-eyebrow">Breakfast · Lunch · Dinner</p>
        <RotatingBrand className="auth-brand" />
      </div>
      <Suspense fallback={<div className="auth-student-card">Loading…</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
