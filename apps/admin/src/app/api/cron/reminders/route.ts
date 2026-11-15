import { NextRequest } from "next/server";
import { error, json } from "@/lib/api";
import { authorizeCron } from "@/lib/cron-auth";
import { runReminders } from "@/lib/cron-reminders";

/**
 * Open / close / tomorrow-menu reminders.
 * On Vercel Hobby: sparse daily slots (see vercel.json).
 * Auth: Authorization: Bearer $CRON_SECRET
 */
async function run(req: NextRequest) {
  if (!authorizeCron(req)) return error("Forbidden", 403);
  const result = await runReminders();
  return json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
