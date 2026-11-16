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
  const rawMenuItemId = body.menu_item_id as string | null | undefined;
  const menuItemId =
    rawMenuItemId === "" || rawMenuItemId == null ? null : String(rawMenuItemId);
  // Default: save plan only. Explicit place_order:true also places tomorrow/today order.
  const placeNow = body.place_order === true;
  const quantity = Math.max(1, Math.min(10, Number(body.quantity || 1)));
  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  const tomorrow = addDaysYmd(dateStr, 1);
  const orderDate = (body.order_date as string) || tomorrow;

  if (!mealType || !["breakfast", "lunch", "dinner"].includes(mealType)) {
    return error("meal_type required");
  }
  if (placeNow && !menuItemId) {
    return error("Select a combo to place an order");
  }

  let itemName: string | null = null;
  let itemPrice: number | null = null;
  if (menuItemId) {
    const item = await query(
      `select * from menu_items where id = $1 and is_active`,
      [menuItemId]
    );
    if (!item.rows[0]) return error("Menu item not found");
    if (item.rows[0].meal_type !== mealType) {
      return error("Selected dish does not match this meal");
    }
    itemName = item.rows[0].name;
    itemPrice = Number(item.rows[0].price);
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
  let orderError: string | null = null;

  if (placeNow && menuItemId) {
    const cutoffs = {
      breakfast: settings.breakfast_cutoff,
      lunch: settings.lunch_cutoff,
      dinner: settings.dinner_cutoff,
    };
    if (orderDate < dateStr) {
      return json(
        {
          plan: rows[0],
          ordered: false,
          order_error: "Cannot order for a past date",
          order_date: orderDate,
          quantity,
          item: itemName
            ? { id: menuItemId, name: itemName, price: itemPrice }
            : null,
        },
        200
      );
    }
    if (
      orderDate === dateStr &&
      !isMealOpen(mealType, cutoffs, new Date(), settings.timezone)
    ) {
      return json(
        {
          plan: rows[0],
          ordered: false,
          order_error: `${mealType} ordering is closed for today`,
          order_date: orderDate,
          quantity,
          item: itemName
            ? { id: menuItemId, name: itemName, price: itemPrice }
            : null,
        },
        200
      );
    }

    try {
      // Only cancel an existing open order once the replacement can succeed.
      // placeOrder itself does not replace — cancel then place inside try.
      await cancelOpenOrdersForMealDate({
        studentId: user.id,
        mealType,
        orderDate,
        source: "any",
      });
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
      orderError = e instanceof Error ? e.message : "Could not place order";
      await notifyUser(
        user.id,
        "Plan saved — order failed",
        orderError,
        { type: "plan_order_failed", meal_type: mealType }
      );
    }
  }

  await notifyUser(
    user.id,
    ordered ? "Combo confirmed · ordered" : "Meal plan updated",
    ordered
      ? `${mealType}: ${itemName || "combo"} ×${quantity} ordered for ${orderDate}`
      : orderError
        ? `Everyday ${mealType} saved · order failed: ${orderError}`
        : `Everyday ${mealType}${itemName ? `: ${itemName}` : ""} is on your plan`,
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
    order_error: orderError,
    order_date: orderDate,
    quantity,
    item: itemName
      ? { id: menuItemId, name: itemName, price: itemPrice }
      : null,
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
