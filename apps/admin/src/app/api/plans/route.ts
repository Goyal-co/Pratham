import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import {
  cancelOpenOrdersForMealDate,
  getSettings,
  notifyUser,
  placeOrder,
} from "@/lib/services";
import {
  getZonedParts,
  isMealOpen,
  type MealType,
} from "@pratham/shared";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const studentId =
    user.role === "admin"
      ? req.nextUrl.searchParams.get("student_id") || user.id
      : user.id;
  const { rows } = await query(
    `select fp.*, mi.name as menu_item_name, mi.price as menu_item_price
     from fixed_plans fp
     left join menu_items mi on mi.id = fp.menu_item_id
     where fp.student_id = $1 and fp.is_active = true`,
    [studentId]
  );
  return json({ plans: rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const body = await req.json();
  const mealType = body.meal_type as MealType;
  const menuItemId = body.menu_item_id as string | null | undefined;

  if (!mealType || !["breakfast", "lunch", "dinner"].includes(mealType)) {
    return error("meal_type required");
  }
  if (!menuItemId) {
    return error("Select a combo / dish for this meal plan");
  }

  const item = await query(
    `select * from menu_items where id = $1 and is_active`,
    [menuItemId]
  );
  if (!item.rows[0]) return error("Menu item not found");
  if (item.rows[0].meal_type !== mealType) {
    return error("Selected dish does not match this meal");
  }

  const existing = await query(
    `select * from fixed_plans
     where student_id = $1 and meal_type = $2 and is_active`,
    [user.id, mealType]
  );
  const prevItemId = existing.rows[0]?.menu_item_id as string | null | undefined;
  const changing =
    !!existing.rows[0] && String(prevItemId || "") !== String(menuItemId);

  await query(
    `update fixed_plans set is_active = false, ended_at = now()
     where student_id = $1 and meal_type = $2 and is_active`,
    [user.id, mealType]
  );
  const { rows } = await query(
    `insert into fixed_plans (student_id, meal_type, menu_item_id, is_active)
     values ($1,$2,$3,true) returning *`,
    [user.id, mealType, menuItemId]
  );

  // Preference only — enabling a plan does NOT charge.
  // If an open plan order already exists for today/tomorrow, swap it and refund/recharge.
  let swapped = 0;
  if (changing) {
    const settings = await getSettings();
    const { dateStr } = getZonedParts(new Date(), settings.timezone);
    const cutoffs = {
      breakfast: settings.breakfast_cutoff,
      lunch: settings.lunch_cutoff,
      dinner: settings.dinner_cutoff,
    };
    const dates = [dateStr];
    const [y, m, d] = dateStr.split("-").map(Number);
    const tm = new Date(Date.UTC(y, m - 1, d + 1));
    dates.push(
      `${tm.getUTCFullYear()}-${String(tm.getUTCMonth() + 1).padStart(2, "0")}-${String(tm.getUTCDate()).padStart(2, "0")}`
    );

    for (const orderDate of dates) {
      const open = await query(
        `select id from orders
         where student_id = $1 and meal_type = $2 and order_date = $3::date
           and source = 'fixed_plan' and status in ('placed','preparing')`,
        [user.id, mealType, orderDate]
      );
      if (!open.rowCount) continue;

      if (
        orderDate === dateStr &&
        !isMealOpen(mealType, cutoffs, new Date(), settings.timezone)
      ) {
        continue;
      }

      await cancelOpenOrdersForMealDate({
        studentId: user.id,
        mealType,
        orderDate,
        source: "fixed_plan",
      });

      try {
        await placeOrder({
          studentId: user.id,
          mealType,
          menuItemId,
          quantity: 1,
          orderDate,
          source: "fixed_plan",
        });
        swapped += 1;
      } catch {
        /* credit/cutoff — preference still saved for future days */
      }
    }
  }

  await notifyUser(
    user.id,
    changing ? "Plan combo updated" : "Fixed plan activated",
    changing
      ? `${mealType} preference set to ${item.rows[0].name}${
          swapped ? ` · ${swapped} open order(s) updated with credit adjust` : ""
        }`
      : `Everyday ${mealType}: ${item.rows[0].name}. Charged only when the meal order is created — change combo anytime before cutoff.`,
    { type: "plan_activated", plan_id: rows[0].id, menu_item_id: menuItemId }
  );

  return json({
    plan: rows[0],
    charged: false,
    swapped_orders: swapped,
    item: {
      id: item.rows[0].id,
      name: item.rows[0].name,
      price: item.rows[0].price,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const mealType = req.nextUrl.searchParams.get("meal_type");
  if (!mealType) return error("meal_type required");

  await query(
    `update fixed_plans set is_active = false, ended_at = now()
     where student_id = $1 and meal_type = $2 and is_active`,
    [user.id, mealType]
  );

  // Stop plan: refund any open future/today plan orders that haven't shipped.
  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  let refunded = 0;
  refunded += await cancelOpenOrdersForMealDate({
    studentId: user.id,
    mealType: mealType as MealType,
    orderDate: dateStr,
    source: "fixed_plan",
  });
  const [y, m, d] = dateStr.split("-").map(Number);
  const tm = new Date(Date.UTC(y, m - 1, d + 1));
  const tomorrow = `${tm.getUTCFullYear()}-${String(tm.getUTCMonth() + 1).padStart(2, "0")}-${String(tm.getUTCDate()).padStart(2, "0")}`;
  refunded += await cancelOpenOrdersForMealDate({
    studentId: user.id,
    mealType: mealType as MealType,
    orderDate: tomorrow,
    source: "fixed_plan",
  });

  return json({ ok: true, refunded_orders: refunded });
}
