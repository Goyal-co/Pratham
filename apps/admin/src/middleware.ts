import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "pratham_token";

/** Lightweight HS256 verify for Edge middleware (avoids jose CompressionStream warnings). */
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

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

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

  const isLogin = path.startsWith("/login");
  const token = request.cookies.get(COOKIE)?.value;
  const secret = process.env.JWT_SECRET || "dev-pratham-secret-change-me";
  let role: string | null = null;
  if (token) {
    const payload = await verifyHs256(token, secret);
    role = payload?.role ? String(payload.role) : null;
  }

  if (!role && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (role && role !== "admin" && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "admin_only");
    const res = NextResponse.redirect(url);
    res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  }

  if (role === "admin" && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
