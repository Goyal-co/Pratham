import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { authCookie, hashPassword, signToken, type AuthUser } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fullName = String(body.full_name || "").trim();
  if (!email || !password || !fullName) {
    return error("full_name, email and password are required");
  }

  const exists = await query(`select 1 from users where email = $1`, [email]);
  if (exists.rowCount) return error("Email already registered", 409);

  const passwordHash = await hashPassword(password);
  const settings = await query(`select default_credit_limit from app_settings where id = 1`);
  const defaultLimit = Number(settings.rows[0]?.default_credit_limit ?? 500);

  const inserted = await query<AuthUser>(
    `insert into users (email, password_hash, role, full_name, phone, hostel, room)
     values ($1,$2,'student',$3,$4,$5,$6)
     returning id, email, role, full_name, phone, hostel, room, referral_code`,
    [
      email,
      passwordHash,
      fullName,
      body.phone || null,
      body.hostel || null,
      body.room || null,
    ]
  );
  const user = inserted.rows[0];

  await query(
    `insert into student_accounts (student_id, credit_limit) values ($1,$2)`,
    [user.id, defaultLimit]
  );

  // Case-insensitive: seeded codes are UPPER, auto hex codes are lowercase
  const code = String(body.referral_code || "").trim();
  if (code) {
    const inviter = await query(
      `select id from users where lower(referral_code) = lower($1) and role = 'student' and id <> $2`,
      [code, user.id]
    );
    if (inviter.rows[0]) {
      await query(
        `insert into referrals (inviter_id, invitee_id) values ($1,$2)
         on conflict (invitee_id) do nothing`,
        [inviter.rows[0].id, user.id]
      );
    }
  }

  const token = await signToken(user);
  const res = json({ user, token });
  res.cookies.set(authCookie(token));
  return res;
}
