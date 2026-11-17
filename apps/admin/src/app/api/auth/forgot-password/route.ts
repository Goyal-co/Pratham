import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { error, json } from "@/lib/api";
import {
  createResetToken,
  normalizePhone,
  sendResetEmail,
} from "@/lib/password-reset";
import { isStudentHost } from "@/lib/hosts";

const GENERIC_OK =
  "If an account matches, we sent a password reset link to that email. Check your inbox (and spam).";

function studentResetUrl(token: string, req: NextRequest) {
  const studentBase = process.env.NEXT_PUBLIC_STUDENT_URL?.trim();
  if (studentBase) {
    return new URL(`/login/reset?token=${token}`, studentBase).toString();
  }
  const host = req.headers.get("host") || "";
  if (isStudentHost(host)) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}/login/reset?token=${token}`;
  }
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000";
  return new URL(`/app/login/reset?token=${token}`, origin).toString();
}

function adminResetUrl(token: string, req: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000";
  return new URL(`/login/reset?token=${token}`, origin).toString();
}

/**
 * POST { email, phone? }
 * Creates a one-time reset token and emails the link.
 * Never returns the token / reset path to the client.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid JSON", 400);

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const phoneRaw = String(body.phone || "").trim();
  if (!email) return error("Email is required");

  if (
    !process.env.RESEND_API_KEY?.trim() ||
    !process.env.EMAIL_FROM?.trim()?.includes("@")
  ) {
    return error(
      "Password reset email is not configured (RESEND_API_KEY + EMAIL_FROM). Ask an admin for help.",
      503
    );
  }

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

  // Same response whether or not the account exists (no enumeration / no token leak).
  if (!user) {
    return json({ ok: true, message: GENERIC_OK, emailed: false });
  }

  const storedPhone = normalizePhone(user.phone || "");
  if (storedPhone) {
    const provided = normalizePhone(phoneRaw);
    if (!provided || provided !== storedPhone) {
      // Do not reveal whether email exists; treat as non-match.
      return json({ ok: true, message: GENERIC_OK, emailed: false });
    }
  }

  const { token } = await createResetToken(user.id);
  const resetUrl =
    user.role === "admin"
      ? adminResetUrl(token, req)
      : studentResetUrl(token, req);

  const mail = await sendResetEmail({
    to: user.email,
    resetUrl,
    name: user.full_name,
  });

  if (!mail.sent) {
    console.error("forgot-password email failed", mail.reason, user.email);
    return error(
      "Could not send the reset email. Try again in a few minutes.",
      502
    );
  }

  return json({ ok: true, message: GENERIC_OK, emailed: true });
}
