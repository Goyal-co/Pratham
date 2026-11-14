import { cookies } from "next/headers";
import { COOKIE, verifyToken } from "@/lib/auth";

export async function requireAdmin() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Cookie: `${COOKIE}=${token ?? ""}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API ${res.status}`);
  }
  return res.json();
}
