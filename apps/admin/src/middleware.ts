import { NextResponse, type NextRequest } from "next/server";
import {
  allowedAppOrigins,
  isStudentHost,
  studentRewritePath,
} from "@/lib/hosts";

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
  if (!origin) return null;
  const allowed = new Set(allowedAppOrigins().map((o) => o.toLowerCase()));
  if (allowed.has(normalizeOrigin(origin).toLowerCase())) return origin;
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

function passOrRewrite(
  request: NextRequest,
  studentHost: boolean,
  publicPath: string,
  internalPath: string
) {
  if (studentHost && publicPath !== internalPath) {
    const url = request.nextUrl.clone();
    url.pathname = internalPath;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const publicPath = request.nextUrl.pathname;
  const host = request.headers.get("host") || "";
  const studentHost = isStudentHost(host);
  const rewritten = studentHost ? studentRewritePath(publicPath) : null;
  const path = rewritten || publicPath;

  // PWA / static assets
  if (
    publicPath === "/manifest.webmanifest" ||
    publicPath === "/admin-manifest.webmanifest" ||
    publicPath === "/admin-sw.js" ||
    publicPath === "/app/sw.js" ||
    publicPath === "/sw.js" ||
    publicPath.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  if (publicPath.startsWith("/api") || path.startsWith("/api")) {
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
    path === "/app/login" ||
    path === "/app/signup" ||
    path === "/app/login/forgot" ||
    path === "/app/login/reset" ||
    path.startsWith("/app/login/forgot") ||
    path.startsWith("/app/login/reset");
  const isAdminLogin = path.startsWith("/login") && !studentHost;

  // —— Student surface ——
  if (isStudentApp) {
    if (!role && !isStudentPublic) {
      const url = request.nextUrl.clone();
      url.pathname = studentHost ? "/login" : "/app/login";
      return NextResponse.redirect(url);
    }
    if (role === "student" && isStudentPublic) {
      const url = request.nextUrl.clone();
      url.pathname = studentHost ? "/" : "/app";
      return NextResponse.redirect(url);
    }
    if (role === "admin" && !isStudentPublic) {
      const adminUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (studentHost && adminUrl) {
        return NextResponse.redirect(new URL("/", adminUrl));
      }
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return passOrRewrite(request, studentHost, publicPath, path);
  }

  // Student host hit something that isn't student app → home
  if (studentHost) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // —— Admin desk ——
  if (role === "student") {
    const studentUrl = process.env.NEXT_PUBLIC_STUDENT_URL;
    if (studentUrl) {
      return NextResponse.redirect(new URL("/", studentUrl));
    }
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
