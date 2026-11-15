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

function addDaysYmd(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

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
  const placeNow = body.place_order !== false; // default: confirm = order
  const quantity = Math.max(1, Math.min(10, Number(body.quantity || 1)));
  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  const tomorrow = addDaysYmd(dateStr, 1);
  const orderDate = (body.order_date as string) || tomorrow;

  if (!mealType || !["breakfast", "lunch", "dinner"].includes(mealType)) {
    return error("meal_type required");
  }
  if (!menuItemId) {
    return error("Select a combo for this meal");
  }

  const item = await query(
    `select * from menu_items where id = $1 and is_active`,
    [menuItemId]
  );
  if (!item.rows[0]) return error("Menu item not found");
  if (item.rows[0].meal_type !== mealType) {
    return error("Selected dish does not match this meal");
  }

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

  let ordered = false;
  let orderId: string | null = null;

  if (placeNow) {
    const cutoffs = {
      breakfast: settings.breakfast_cutoff,
      lunch: settings.lunch_cutoff,
      dinner: settings.dinner_cutoff,
    };
    if (orderDate < dateStr) {
      return error("Cannot order for a past date");
    }
    if (
      orderDate === dateStr &&
      !isMealOpen(mealType, cutoffs, new Date(), settings.timezone)
    ) {
      return error(`${mealType} ordering is closed for today`);
    }

    // Replace any open plan order for that date
    await cancelOpenOrdersForMealDate({
      studentId: user.id,
      mealType,
      orderDate,
      source: "any",
    });

    try {
      const order = await placeOrder({
        studentId: user.id,
        mealType,
        menuItemId,
        quantity,
        orderDate,
        source: "fixed_plan",
      });
      ordered = true;
      orderId = order.id;
    } catch (e) {
      await notifyUser(
        user.id,
        "Plan saved — order failed",
        e instanceof Error ? e.message : "Could not place order",
        { type: "plan_order_failed", meal_type: mealType }
      );
      return error(
        e instanceof Error
          ? `Plan saved but order failed: ${e.message}`
          : "Plan saved but order failed"
      );
    }
  }

  await notifyUser(
    user.id,
    ordered ? "Combo confirmed · ordered" : "Plan combo saved",
    ordered
      ? `${mealType}: ${item.rows[0].name} ×${quantity} ordered for ${orderDate}`
      : `Everyday ${mealType}: ${item.rows[0].name}`,
    {
      type: "plan_activated",
      plan_id: rows[0].id,
      menu_item_id: menuItemId,
      order_id: orderId,
      quantity,
    }
  );

  return json({
    plan: rows[0],
    ordered,
    order_id: orderId,
    order_date: orderDate,
    quantity,
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

  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  let refunded = 0;
  refunded += await cancelOpenOrdersForMealDate({
    studentId: user.id,
    mealType: mealType as MealType,
    orderDate: dateStr,
    source: "fixed_plan",
  });
  const tomorrow = addDaysYmd(dateStr, 1);
  refunded += await cancelOpenOrdersForMealDate({
    studentId: user.id,
    mealType: mealType as MealType,
    orderDate: tomorrow,
    source: "fixed_plan",
  });

  return json({ ok: true, refunded_orders: refunded });
}
