import { NextRequest } from "next/server";
import { error, json } from "@/lib/api";
import { authorizeCron } from "@/lib/cron-auth";
import { runReminders } from "@/lib/cron-reminders";
import { generateFixedPlanOrders } from "@/lib/services";
import { writeAudit } from "@/lib/audit";

/**
 * Fixed-plan auto-orders, then a reminder sweep (Hobby-friendly: one hit does both).
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

  // Piggyback reminders so Hobby's 5/day limit still covers closing windows
  let reminders: Awaited<ReturnType<typeof runReminders>> | null = null;
  try {
    reminders = await runReminders();
  } catch {
    reminders = null;
  }

  return json({
    ok: true,
    created,
    reminders: reminders?.sent ?? [],
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
