import { NextRequest } from "next/server";
import { error, json } from "@/lib/api";
import { authorizeCron } from "@/lib/cron-auth";
import { generateFixedPlanOrders } from "@/lib/services";
import { writeAudit } from "@/lib/audit";

/**
 * Secured cron endpoint for fixed-plan auto-orders.
 * Vercel Cron invokes GET; local scripts may POST.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
async function run(req: NextRequest) {
  if (!authorizeCron(req)) return error("Forbidden", 403);

  const body =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};
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
