import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { hashPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";

/** One-time bootstrap: POST { email, password, full_name, secret } — create only, never promote. */
export async function POST(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_BOOTSTRAP !== "true"
  ) {
    return error("Bootstrap disabled in production", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid JSON", 400);

  const bootstrap =
    process.env.NODE_ENV === "production"
      ? process.env.BOOTSTRAP_SECRET
      : process.env.BOOTSTRAP_SECRET || "pratham-bootstrap";
  if (!bootstrap) return error("BOOTSTRAP_SECRET is not configured", 500);
  if (body.secret !== bootstrap) return error("Forbidden", 403);

  const email = String(body.email || "titanscortex@gmail.com").toLowerCase();
  const password = String(body.password || "Titans@$#123");
  const fullName = String(body.full_name || "Ahariva Admin");

  const existing = await query(`select id, role from users where email = $1`, [
    email,
  ]);
  if (existing.rows[0]) {
    return error(
      "User already exists — bootstrap will not promote or overwrite accounts",
      409
    );
  }

  const hash = await hashPassword(password);
  await query(
    `insert into users (email, password_hash, role, full_name)
     values ($1,$2,'admin',$3)`,
    [email, hash, fullName]
  );
  return json({ ok: true, created: true, email });
}
