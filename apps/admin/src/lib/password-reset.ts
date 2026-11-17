import { createHash, randomBytes } from "node:crypto";
import { query } from "@pratham/db";

const TTL_MINUTES = 30;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizePhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function createResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expires = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await query(
    `insert into password_reset_tokens (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, tokenHash, expires.toISOString()]
  );
  return { token, expiresAt: expires };
}

export async function consumeResetToken(token: string) {
  const tokenHash = hashResetToken(token);
  const { rows } = await query<{
    id: string;
    user_id: string;
    expires_at: string;
    used_at: string | null;
  }>(
    `select id, user_id, expires_at::text, used_at::text
     from password_reset_tokens
     where token_hash = $1`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await query(
    `update password_reset_tokens set used_at = now() where id = $1`,
    [row.id]
  );
  // Invalidate other unused tokens for this user
  await query(
    `update password_reset_tokens
     set used_at = now()
     where user_id = $1 and used_at is null and id <> $2`,
    [row.user_id, row.id]
  );
  return row.user_id;
}

export async function sendResetEmail(opts: {
  to: string;
  resetUrl: string;
  name?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromRaw = process.env.EMAIL_FROM?.trim();
  if (!apiKey) return { sent: false as const, reason: "email_not_configured" };
  if (!fromRaw || !fromRaw.includes("@")) {
    return { sent: false as const, reason: "email_from_missing" };
  }
  const from = fromRaw.includes("<") ? fromRaw : `Ahariva <${fromRaw}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: "Reset your Ahariva password",
      html: `<p>Hi ${opts.name || "there"},</p>
<p>Reset your password using this link (valid ${TTL_MINUTES} minutes):</p>
<p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>
<p>If you did not request this, ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Resend failed", res.status, text);
    return { sent: false as const, reason: "send_failed" };
  }
  return { sent: true as const };
}
