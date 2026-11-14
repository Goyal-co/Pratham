import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getZonedParts } from "@pratham/shared";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const today = getZonedParts().dateStr;

  const orders = await query(
    `select meal_type, quantity, payable_amount, status from orders
     where order_date = $1 and status <> 'cancelled'`,
    [today]
  );
  const students = await query(
    `select count(*)::int as c from users where role = 'student'`
  );
  const pendingRefs = await query(
    `select count(*)::int as c from referrals where status = 'pending'`
  );

  const byMeal = { breakfast: 0, lunch: 0, dinner: 0 };
  let kitchenUnits = 0;
  let revenue = 0;
  for (const o of orders.rows) {
    byMeal[o.meal_type as keyof typeof byMeal] += o.quantity;
    kitchenUnits += o.quantity;
    revenue += Number(o.payable_amount);
  }

  return json({
    today,
    kitchenUnits,
    revenue,
    studentCount: students.rows[0].c,
    pendingReferrals: pendingRefs.rows[0].c,
    byMeal,
  });
}
