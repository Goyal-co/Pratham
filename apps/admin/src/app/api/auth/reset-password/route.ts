import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { error, json } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { consumeResetToken } from "@/lib/password-reset";
import { writeAudit } from "@/lib/audit";

/** POST { token, password } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid JSON", 400);

  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token) return error("Reset token is required");
  if (password.length < 6) {
    return error("Password must be at least 6 characters");
  }

  const userId = await consumeResetToken(token);
  if (!userId) return error("Reset link is invalid or expired", 400);

  const passwordHash = await hashPassword(password);
  await query(`update users set password_hash = $1 where id = $2`, [
    passwordHash,
    userId,
  ]);

  await writeAudit({
    actorId: userId,
    action: "auth.password_reset",
    entity: "users",
    entityId: userId,
    note: "Password reset via forgot-password",
  });

  return json({ ok: true, message: "Password updated. You can sign in now." });
}
