import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import {
  authCookie,
  signToken,
  verifyPassword,
  type AuthUser,
} from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return error("Email and password required");

  const { rows } = await query<AuthUser & { password_hash: string }>(
    `select id, email, role, full_name, phone, hostel, room, referral_code, password_hash
     from users where email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error("Invalid credentials", 401);
  }

  const { password_hash: _, ...safe } = user;
  const token = await signToken(safe);
  const res = json({ user: safe, token });
  res.cookies.set(authCookie(token));
  return res;
}
