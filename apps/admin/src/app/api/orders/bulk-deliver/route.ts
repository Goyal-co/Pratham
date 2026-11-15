import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { updateOrderStatus } from "@/lib/services";
import { getZonedParts, type MealType } from "@pratham/shared";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const body = await req.json();
  const mealType = body.meal_type as MealType;
  const { dateStr } = getZonedParts();
  const orderDate = (body.date as string) || dateStr;

  if (!MEALS.includes(mealType)) return error("meal_type must be breakfast, lunch, or dinner");

  const { rows } = await query(
    `select id from orders
     where order_date = $1::date
       and meal_type = $2
       and status in ('placed','preparing','out_for_delivery')
     order by created_at`,
    [orderDate, mealType]
  );

  let delivered = 0;
  const errors: string[] = [];
  for (const row of rows) {
    try {
      await updateOrderStatus(row.id, "delivered", user.id);
      delivered += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "failed");
    }
  }

  return json({
    meal_type: mealType,
    date: orderDate,
    delivered,
    skipped: rows.length - delivered,
    errors: errors.slice(0, 5),
  });
}
