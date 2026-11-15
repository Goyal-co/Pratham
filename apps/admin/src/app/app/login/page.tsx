"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";
import { InstallHint } from "@/components/student/InstallHint";
import { RotatingBrand } from "@/components/RotatingBrand";
import { studentHref, useStudentBase } from "@/lib/student-paths";

export default function StudentLoginPage() {
  const router = useRouter();
  const base = useStudentBase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ user: { role: string } }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      if (data.user.role !== "student") {
        await api("/api/auth/logout", { method: "POST" });
        setError("Use the student account, or open /login for admin.");
        setBusy(false);
        return;
      }
      router.push(studentHref(base));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth-student">
      <div className="auth-student-hero">
        <p className="auth-eyebrow">Breakfast · Lunch · Dinner</p>
        <RotatingBrand className="auth-brand" />
        <p className="auth-tagline">
          Meals to your hostel — cash on delivery, skip when you need to.
        </p>
      </div>

      <InstallHint />

      <form className="auth-student-card" onSubmit={onSubmit}>
        <h2 className="auth-form-title">Welcome back</h2>
        <p className="student-muted">
          Sign in to order today’s breakfast, lunch, or dinner.
        </p>
        <label className="student-field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@college.edu"
          />
        </label>
        <label className="student-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p style={{ color: "var(--s-danger)", marginBottom: 12 }}>{error}</p>
        )}
        <button className="student-btn" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <Link className="student-link" href={studentHref(base, "/login/forgot")}>
          Forgot password?
        </Link>
        <Link className="student-link" href={studentHref(base, "/signup")}>
          New here? Create account
        </Link>
      </form>
    </div>
  );
}
