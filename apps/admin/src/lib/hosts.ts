/** Hostname helpers for optional admin / student subdomains. */

export function hostnameOf(url: string | undefined | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function adminHostname() {
  return hostnameOf(process.env.NEXT_PUBLIC_APP_URL);
}

export function studentHostname() {
  return hostnameOf(process.env.NEXT_PUBLIC_STUDENT_URL);
}

export function isStudentHost(host: string) {
  const h = host.toLowerCase().split(":")[0];
  const student = studentHostname();
  if (student && h === student) return true;
  // Local / preview convenience when STUDENT_URL unset
  if (!student && (h.startsWith("app.") || h.startsWith("student."))) {
    return true;
  }
  return false;
}

export function isAdminHost(host: string) {
  const h = host.toLowerCase().split(":")[0];
  const admin = adminHostname();
  if (admin && h === admin) return true;
  if (h.startsWith("admin.")) return true;
  return false;
}

/** Map pretty student-subdomain paths → /app/* */
export function studentRewritePath(pathname: string): string | null {
  if (pathname === "/" || pathname === "") return "/app";
  if (pathname === "/login") return "/app/login";
  if (pathname === "/signup") return "/app/signup";
  if (pathname === "/login/forgot") return "/app/login/forgot";
  if (pathname === "/login/reset") return "/app/login/reset";
  if (pathname === "/forgot") return "/app/login/forgot";
  if (pathname === "/reset") return "/app/login/reset";
  const map: Record<string, string> = {
    "/orders": "/app/orders",
    "/plans": "/app/plans",
    "/wallet": "/app/wallet",
    "/profile": "/app/profile",
    "/notifications": "/app/notifications",
  };
  if (map[pathname]) return map[pathname];
  return null;
}

export function allowedAppOrigins(): string[] {
  const out: string[] = [];
  for (const u of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_STUDENT_URL,
  ]) {
    if (!u) continue;
    try {
      out.push(new URL(u).origin);
    } catch {
      /* skip */
    }
  }
  return out;
}
