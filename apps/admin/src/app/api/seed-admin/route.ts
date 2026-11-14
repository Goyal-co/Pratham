import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { hashPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";

/** One-time bootstrap: POST { email, password, full_name, secret } */
export async function POST(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_BOOTSTRAP !== "true"
  ) {
    return error("Bootstrap disabled in production", 403);
  }
  const body = await req.json();
  const bootstrap = process.env.BOOTSTRAP_SECRET || "pratham-bootstrap";
  if (body.secret !== bootstrap) return error("Forbidden", 403);

  const email = String(body.email || "admin@pratham.local").toLowerCase();
  const password = String(body.password || "admin123");
  const fullName = String(body.full_name || "Pratham Admin");

  const existing = await query(`select id from users where email = $1`, [email]);
  if (existing.rows[0]) {
    await query(`update users set role = 'admin' where id = $1`, [
      existing.rows[0].id,
    ]);
    return json({ ok: true, updated: true, email });
  }

  const hash = await hashPassword(password);
  await query(
    `insert into users (email, password_hash, role, full_name)
     values ($1,$2,'admin',$3)`,
    [email, hash, fullName]
  );
  return json({ ok: true, created: true, email });
}
