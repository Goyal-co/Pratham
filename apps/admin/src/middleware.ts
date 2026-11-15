import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "pratham_token";

async function verifyHs256(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(sigB64);
  const ok = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!ok) return null;
  try {
    const json = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadB64))
    ) as { role?: string; exp?: number };
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return json;
  } catch {
    return null;
  }
}

function base64UrlToBytes(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function normalizeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function allowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null; // same-origin / non-browser
  const app = process.env.NEXT_PUBLIC_APP_URL
    ? normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
    : "";
  if (app && normalizeOrigin(origin) === app) return origin;
  // Dev convenience: allow localhost variants when APP_URL is localhost
  if (
    process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    return origin;
  }
  return null;
}

function corsHeaders(request: NextRequest) {
  const allowed = allowedOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers.Vary = "Origin";
  }
  return headers;
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return "dev-pratham-secret-change-me";
  }
  return secret;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // PWA / static assets
  if (
    path === "/manifest.webmanifest" ||
    path === "/admin-manifest.webmanifest" ||
    path === "/admin-sw.js" ||
    path === "/app/sw.js" ||
    path.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  if (path.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }
    const res = NextResponse.next();
    Object.entries(corsHeaders(request)).forEach(([k, v]) =>
      res.headers.set(k, v)
    );
    return res;
  }

  const token = request.cookies.get(COOKIE)?.value;
  const secret = jwtSecret();
  let role: string | null = null;
  if (token) {
    const payload = await verifyHs256(token, secret);
    role = payload?.role ? String(payload.role) : null;
  }

  const isStudentApp = path === "/app" || path.startsWith("/app/");
  const isStudentPublic =
    path === "/app/login" || path === "/app/signup";
  const isAdminLogin = path.startsWith("/login");

  // —— Student PWA (/app) ——
  if (isStudentApp) {
    if (!role && !isStudentPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/app/login";
      return NextResponse.redirect(url);
    }
    if (role === "student" && isStudentPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
    if (role === "admin" && !isStudentPublic) {
      // Admins use the desk at /
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // —— Admin desk ——
  if (role === "student") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  if (!role && !isAdminLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (role && role !== "admin" && !isAdminLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "admin_only");
    const res = NextResponse.redirect(url);
    res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  }

  if (role === "admin" && isAdminLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
