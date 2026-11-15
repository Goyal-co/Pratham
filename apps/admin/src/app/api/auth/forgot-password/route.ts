import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { error, json } from "@/lib/api";
import {
  createResetToken,
  normalizePhone,
  sendResetEmail,
} from "@/lib/password-reset";

/**
 * POST { email, phone? }
 * - If the account has a phone on file, phone must match (ownership check).
 * - Returns a one-time resetPath so the client can open the reset form.
 * - Also emails the link when RESEND_API_KEY is configured.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid JSON", 400);

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const phoneRaw = String(body.phone || "").trim();
  if (!email) return error("Email is required");

  const { rows } = await query<{
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  }>(
    `select id, email, full_name, phone, role from users where email = $1`,
    [email]
  );
  const user = rows[0];

  // Always look successful to avoid account enumeration timing tells in UI copy;
  // but when credentials match we return a reset path.
  if (!user) {
    return json({
      ok: true,
      message:
        "If that account exists and details match, you can reset your password.",
    });
  }

  const storedPhone = normalizePhone(user.phone || "");
  if (storedPhone) {
    const provided = normalizePhone(phoneRaw);
    if (!provided || provided !== storedPhone) {
      return error("Email and phone do not match our records", 400);
    }
  } else if (!phoneRaw && process.env.NODE_ENV === "production") {
    // Admin / accounts without phone: require email delivery in production
    if (!process.env.RESEND_API_KEY) {
      return error(
        "No phone on this account. Ask another admin to reset, or configure email (RESEND_API_KEY).",
        400
      );
    }
  }

  const { token } = await createResetToken(user.id);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000";
  const resetPath =
    user.role === "admin"
      ? `/login/reset?token=${token}`
      : `/app/login/reset?token=${token}`;
  const resetUrl = new URL(resetPath, origin).toString();

  const mail = await sendResetEmail({
    to: user.email,
    resetUrl,
    name: user.full_name,
  });

  return json({
    ok: true,
    message: mail.sent
      ? "Reset link sent to your email. You can also continue here."
      : "Verified — set a new password next.",
    resetPath,
    emailed: mail.sent,
  });
}
