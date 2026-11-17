import { hostnameOf } from "./hosts";

/** Resolve SW script + scope for /app host vs app.ahariva.com student subdomain. */
export function studentSwOptions(): { url: string; scope: string } {
  if (typeof window === "undefined") {
    return { url: "/app/sw.js", scope: "/app" };
  }
  const studentHost = hostnameOf(process.env.NEXT_PUBLIC_STUDENT_URL);
  const host = window.location.hostname.toLowerCase();
  const onStudentHost =
    Boolean(studentHost && host === studentHost) ||
    host.startsWith("app.") ||
    host.startsWith("student.");

  // Student subdomain uses pretty URLs (/menu, /), so SW must own "/".
  if (onStudentHost) {
    return { url: "/sw.js", scope: "/" };
  }
  // Same-origin /app mount (localhost:3000/app, admin domain /app)
  // Scope "/app" needs Service-Worker-Allowed on /app/sw.js (see next.config).
  return { url: "/app/sw.js", scope: "/app" };
}

export async function registerStudentSw() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported");
  }
  const { url, scope } = studentSwOptions();
  return navigator.serviceWorker.register(url, { scope });
}

export async function getStudentSwRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  const { scope } = studentSwOptions();
  return (
    (await navigator.serviceWorker.getRegistration(scope)) ||
    (await navigator.serviceWorker.getRegistration("/app/")) ||
    (await navigator.serviceWorker.getRegistration("/app")) ||
    (await navigator.serviceWorker.getRegistration("/"))
  );
}
