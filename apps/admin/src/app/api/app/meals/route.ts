import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getZonedParts, type MealType } from "@pratham/shared";
import { error, json } from "@/lib/api";
import { getUserFromRequest } from "@/lib/auth";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Unauthorized", 401);

  const { dateStr } = getZonedParts();
  const month =
    req.nextUrl.searchParams.get("month") || dateStr.slice(0, 7);
  const { start, end } = monthRange(month);

  const [plans, cancellations, orders] = await Promise.all([
    query(
      `select fp.id, fp.meal_type, fp.menu_item_id, mi.name as menu_item_name
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
      [user.id, start, end]
    ),
    query(
      `select o.id, o.meal_type, o.quantity, o.payable_amount, o.gross_amount,
              o.status, o.order_date::text as order_date,
              mi.name as item_name, mi.name as menu_item_name
       from orders o
       left join menu_items mi on mi.id = o.menu_item_id
       where o.student_id = $1
       order by o.created_at desc
       limit 8`,
      [user.id]
    ),
  ]);

  return json({
    plans: plans.rows,
    cancellations: cancellations.rows.map((r) => ({
      meal_type: r.meal_type as MealType,
      cancel_date: String(r.cancel_date).slice(0, 10),
    })),
    orders: orders.rows,
    month,
  });
}
