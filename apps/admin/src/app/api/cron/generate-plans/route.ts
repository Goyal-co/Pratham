import { NextRequest } from "next/server";
import { error, json } from "@/lib/api";
import { generateFixedPlanOrders } from "@/lib/services";
import { writeAudit } from "@/lib/audit";

/**
 * Secured cron endpoint for fixed-plan auto-orders.
 * Vercel Cron invokes GET; local scripts may POST.
 * Auth: Authorization: Bearer $CRON_SECRET (Vercel sets this automatically when CRON_SECRET is configured).
 */
async function run(req: NextRequest) {
  const secret =
    process.env.CRON_SECRET || process.env.BOOTSTRAP_SECRET || "pratham-bootstrap";
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const body =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const provided =
    bearer ||
    body.secret ||
    req.nextUrl.searchParams.get("secret") ||
    "";
  if (provided !== secret) return error("Forbidden", 403);

  const date =
    body.date || req.nextUrl.searchParams.get("date") || undefined;
  const created = await generateFixedPlanOrders(date);
  await writeAudit({
    actorId: null,
    action: "cron.generate_plans",
    entity: "orders",
    after: { created, date: date || null },
    note: "Fixed-plan generation via cron",
  });
  return json({ ok: true, created });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
