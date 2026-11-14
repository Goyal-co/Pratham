"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

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

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form className="card" style={{ width: "min(420px, 100%)" }} onSubmit={onSubmit}>
        <h1 style={{ marginTop: 0 }}>Admin login</h1>
        <p className="muted">COD kitchen desk for Pratham Tiffin · Postgres</p>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="btn" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
