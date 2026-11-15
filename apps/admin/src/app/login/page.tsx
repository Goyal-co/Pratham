"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";
import { AdminPwa } from "@/components/AdminPwa";
import { RotatingBrand } from "@/components/RotatingBrand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: { role: string } }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      if (data.user.role !== "admin") {
        await api("/api/auth/logout", { method: "POST" });
        setError("This account is not an admin.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  const studentUrl =
    process.env.NEXT_PUBLIC_STUDENT_URL ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/app`
      : "/app");

  return (
    <main className="auth-admin">
      <div className="auth-admin-panel">
        <div className="auth-admin-brand">
          <p className="auth-eyebrow">Kitchen desk</p>
          <RotatingBrand className="auth-brand" />
          <p className="auth-tagline">
            Kitchen desk for breakfast, lunch & dinner — COD, installable on
            your phone.
          </p>
        </div>

        <AdminPwa />

        <form className="auth-admin-card" onSubmit={onSubmit}>
          <h2 className="auth-form-title">Admin login</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Students order at{" "}
            <a href={studentUrl} className="auth-inline-link">
              the student app
            </a>
            .
          </p>
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin@gmail.com"
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button className="btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
      <div className="auth-admin-visual" aria-hidden>
        <div className="auth-admin-visual-inner">
          <span>Breakfast · Lunch · Dinner</span>
          <strong>Meal ops desk</strong>
        </div>
      </div>
    </main>
  );
}
