import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { creditAvailable, debtFromWallet, getZonedParts } from "@pratham/shared";
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
        `select credit_limit, wallet_credit
         from student_accounts where student_id = $1`,
        [user.id]
      ),
      query(
        `select fp.id, fp.meal_type, fp.is_active, fp.menu_item_id,
                mi.name as menu_item_name
         from fixed_plans fp
         left join menu_items mi on mi.id = fp.menu_item_id
         where fp.student_id = $1 and fp.is_active`,
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

  const acct = account.rows[0] ?? { credit_limit: 0, wallet_credit: 0 };
  const wallet = Number(acct.wallet_credit);
  const limit = Number(acct.credit_limit);

  return json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      hostel: user.hostel,
      room: user.room,
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
    account: {
      credit_limit: limit,
      wallet_credit: wallet,
      debt: debtFromWallet(wallet),
      credit_available: creditAvailable(wallet, limit),
    },
  });
}
