"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

export default function StudentLoginPage() {
  const router = useRouter();
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
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <form className="student-card" onSubmit={onSubmit}>
      <h1 className="student-title">Pratham</h1>
      <p className="student-muted">Student tiffin · cash on delivery</p>
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
      <Link className="student-link" href="/app/signup">
        New here? Create account
      </Link>
    </form>
  );
}
