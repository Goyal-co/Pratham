import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeCutoff(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const normalized = `${m[1].padStart(2, "0")}:${m[2]}`;
  return HHMM.test(normalized) ? normalized : null;
}

export async function GET() {
  const { rows } = await query(`select * from app_settings where id = 1`);
  return json({ settings: rows[0] });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const body = await req.json();
  const before = await query(`select * from app_settings where id = 1`);

  const breakfast = normalizeCutoff(body.breakfast_cutoff);
  const lunch = normalizeCutoff(body.lunch_cutoff);
  const dinner = normalizeCutoff(body.dinner_cutoff);

  if (body.breakfast_cutoff != null && breakfast == null) {
    return error("breakfast_cutoff must be HH:mm (e.g. 05:00 or 06:00)");
  }
  if (body.lunch_cutoff != null && lunch == null) {
    return error("lunch_cutoff must be HH:mm");
  }
  if (body.dinner_cutoff != null && dinner == null) {
    return error("dinner_cutoff must be HH:mm");
  }

  const lead =
    body.reminder_lead_minutes != null
      ? Number(body.reminder_lead_minutes)
      : null;
  if (lead != null && (lead < 5 || lead > 180 || Number.isNaN(lead))) {
    return error("reminder_lead_minutes must be 5–180");
  }

  const { rows } = await query(
    `update app_settings set
      breakfast_cutoff = coalesce($1, breakfast_cutoff),
      lunch_cutoff = coalesce($2, lunch_cutoff),
      dinner_cutoff = coalesce($3, dinner_cutoff),
      referral_min_completed_orders = coalesce($4, referral_min_completed_orders),
      referral_reward_credits = coalesce($5, referral_reward_credits),
      default_credit_limit = coalesce($6, default_credit_limit),
      reminder_lead_minutes = coalesce($7, reminder_lead_minutes),
      updated_at = now()
     where id = 1 returning *`,
    [
      breakfast,
      lunch,
      dinner,
      body.referral_min_completed_orders ?? null,
      body.referral_reward_credits ?? null,
      body.default_credit_limit ?? null,
      lead,
    ]
  );
  await writeAudit({
    actorId: user.id,
    action: "settings.update",
    entity: "app_settings",
    entityId: "1",
    before: before.rows[0],
    after: rows[0],
  });
  return json({ settings: rows[0] });
}
