"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";
import { RotatingBrand } from "@/components/RotatingBrand";
import { studentHref, useStudentBase } from "@/lib/student-paths";

export default function StudentForgotPasswordPage() {
  const router = useRouter();
  const base = useStudentBase();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{
        ok: boolean;
        resetPath?: string;
        message?: string;
      }>("/api/auth/forgot-password", {
        method: "POST",
        json: { email, phone },
      });
      if (data.resetPath) {
        // Prefer student-base path when on subdomain
        const token = new URL(data.resetPath, "http://local").searchParams.get(
          "token"
        );
        router.push(
          `${studentHref(base, "/login/reset")}${token ? `?token=${token}` : ""}`
        );
        return;
      }
      setError(data.message || "Check your details and try again.");
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
        <RotatingBrand className="auth-brand" />
        <p className="auth-tagline">Reset your password with email + phone.</p>
      </div>

      <form className="auth-student-card" onSubmit={onSubmit}>
        <h2 className="auth-form-title">Forgot password</h2>
        <p className="student-muted">
          Use the phone number from your signup to verify it’s you.
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
          <p style={{ color: "var(--s-danger)", marginBottom: 12 }}>{error}</p>
        )}
        <button className="student-btn" disabled={busy} type="submit">
          {busy ? "Checking…" : "Continue"}
        </button>
        <Link className="student-link" href={studentHref(base, "/login")}>
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
