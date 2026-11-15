"use client";

import Link from "next/link";
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
      <section className="auth-admin-panel">
        <div className="auth-admin-panel-inner">
          <header className="auth-admin-brand">
            <p className="auth-eyebrow">Kitchen desk</p>
            <RotatingBrand className="auth-brand" />
            <p className="auth-tagline">
              Run breakfast, lunch & dinner orders — COD collections, menu, and
              kitchen status.
            </p>
          </header>

          <AdminPwa />

          <form className="auth-admin-card" onSubmit={onSubmit}>
            <div className="auth-admin-card-head">
              <h2 className="auth-form-title">Admin login</h2>
              <p className="auth-form-sub">
                Students order at{" "}
                <a href={studentUrl} className="auth-inline-link">
                  the student app
                </a>
                .
              </p>
            </div>

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
                placeholder="••••••••"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button className="btn auth-admin-submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <Link
              href="/login/forgot"
              className="auth-inline-link"
              style={{ display: "block", textAlign: "center", marginTop: 14 }}
            >
              Forgot password?
            </Link>
          </form>

          <p className="auth-admin-foot">
            Secure staff access · COD only · IST cutoffs
          </p>
        </div>
      </section>

      <aside className="auth-admin-visual" aria-hidden>
        <div className="auth-admin-visual-glow" />
        <div className="auth-admin-visual-grid">
          <article className="auth-meal-tile">
            <span>Breakfast</span>
            <strong>Until 06:00</strong>
            <p>Fixed plans + ad-hoc extras</p>
          </article>
          <article className="auth-meal-tile">
            <span>Lunch</span>
            <strong>Until 11:00</strong>
            <p>Kitchen prep & dispatch</p>
          </article>
          <article className="auth-meal-tile">
            <span>Dinner</span>
            <strong>Until 17:00</strong>
            <p>COD balance clear</p>
          </article>
        </div>
        <div className="auth-admin-visual-inner">
          <span>Breakfast · Lunch · Dinner</span>
          <strong>Meal ops desk</strong>
          <p>Orders, menu publish, students, referrals — one installable desk.</p>
        </div>
      </aside>
    </main>
  );
}
