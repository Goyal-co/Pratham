import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { query } from "@pratham/db";

export type AuthUser = {
  id: string;
  email: string;
  role: "student" | "admin";
  full_name: string | null;
  phone: string | null;
  hostel: string | null;
  room: string | null;
  referral_code: string;
};

const COOKIE = "pratham_token";

function secretKey() {
  const secret = process.env.JWT_SECRET || "dev-pratham-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(user: AuthUser) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = String(payload.sub);
    const { rows } = await query<AuthUser>(
      `select id, email, role, full_name, phone, hostel, room, referral_code
       from users where id = $1`,
      [id]
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.cookies.get(COOKIE)?.value;
  const token = bearer || cookieToken;
  if (!token) return null;
  return verifyToken(token);
}

export async function getUserFromCookies() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function authCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export { COOKIE };
