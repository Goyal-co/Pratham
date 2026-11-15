"use client";

import { hostnameOf } from "./hosts";

/** Client-side student paths that work on /app and on student subdomain. */
export function useStudentBase(): "" | "/app" {
  if (typeof window === "undefined") return "/app";
  const studentHost = hostnameOf(process.env.NEXT_PUBLIC_STUDENT_URL);
  const host = window.location.hostname.toLowerCase();
  if (studentHost && host === studentHost) return "";
  if (host.startsWith("app.") || host.startsWith("student.")) return "";
  return "/app";
}

export function studentHref(base: "" | "/app", path = ""): string {
  const p = path.startsWith("/") ? path : path ? `/${path}` : "";
  if (!base) return p || "/";
  return `${base}${p}` || "/app";
}
