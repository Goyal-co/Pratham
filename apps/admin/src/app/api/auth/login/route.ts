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
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid JSON", 400);

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return error("Email and password required");

  let user: (AuthUser & { password_hash: string }) | undefined;
  try {
    const { rows } = await query<AuthUser & { password_hash: string }>(
      `select id, email, role, full_name, phone, hostel, room, referral_code, password_hash
       from users where email = $1`,
      [email]
    );
    user = rows[0];
  } catch (e) {
    console.error("login db error", e instanceof Error ? e.message : e);
    return error(
      "Database unavailable. Check DATABASE_URL and that Postgres is reachable.",
      503
    );
  }

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error("Invalid credentials", 401);
  }

  try {
    const { password_hash: _, ...safe } = user;
    const token = await signToken(safe);
    const res = json({ user: safe, token });
    res.cookies.set(authCookie(token));
    return res;
  } catch (e) {
    console.error("login token error", e instanceof Error ? e.message : e);
    return error("Could not create session. Check JWT_SECRET.", 500);
  }
}
