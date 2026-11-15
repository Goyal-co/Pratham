import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getZonedParts } from "@pratham/shared";
import { error, json } from "@/lib/api";
import { getUserFromRequest } from "@/lib/auth";
import { getMenuForDate } from "@/lib/menu";
import { getSettings } from "@/lib/services";

function addDaysYmd(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** One round-trip bootstrap for the student home screen. */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Unauthorized", 401);

  const { dateStr } = getZonedParts();
  const tomorrow = addDaysYmd(dateStr, 1);
  const calendarEnd = addDaysYmd(dateStr, 13);

  const [settings, todayItems, tomorrowItems, account, plans, cancellations] =
    await Promise.all([
      getSettings(),
      getMenuForDate(dateStr),
      getMenuForDate(tomorrow),
      query(
        `select credit_limit, outstanding_balance, wallet_credit
         from student_accounts where student_id = $1`,
        [user.id]
      ),
      query(
        `select id, meal_type, is_active from fixed_plans
         where student_id = $1 and is_active`,
        [user.id]
      ),
      query(
        `select meal_type, cancel_date::text as cancel_date
         from plan_cancellations
         where student_id = $1
           and cancel_date >= $2::date
           and cancel_date <= $3::date`,
        [user.id, dateStr, calendarEnd]
      ),
    ]);

  return json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      referral_code: user.referral_code,
    },
    date: dateStr,
    tomorrow,
    settings,
    todayItems,
    tomorrowItems,
    plans: plans.rows,
    cancellations: cancellations.rows.map((r) => ({
      meal_type: r.meal_type,
      cancel_date: String(r.cancel_date).slice(0, 10),
    })),
    account: account.rows[0] ?? {
      credit_limit: 0,
      outstanding_balance: 0,
      wallet_credit: 0,
    },
  });
}
