import { NextRequest } from "next/server";

/** Bearer-only cron auth. Production requires CRON_SECRET. */
export function authorizeCron(req: NextRequest): boolean {
  const secret =
    process.env.NODE_ENV === "production"
      ? process.env.CRON_SECRET
      : process.env.CRON_SECRET ||
        process.env.BOOTSTRAP_SECRET ||
        "pratham-bootstrap";
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer === secret;
}
