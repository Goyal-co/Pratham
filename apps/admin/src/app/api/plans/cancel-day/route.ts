import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import {
  cancelOpenOrdersForMealDate,
  getSettings,
  notifyUser,
} from "@/lib/services";
import { getZonedParts, isMealOpen, type MealType } from "@pratham/shared";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

function parseMeals(body: {
  meal_types?: unknown;
  meal_type?: unknown;
}): MealType[] {
  if (Array.isArray(body.meal_types)) {
    return body.meal_types.filter((m): m is MealType =>
      MEALS.includes(m as MealType)
    );
  }
  if (typeof body.meal_type === "string" && MEALS.includes(body.meal_type as MealType)) {
    return [body.meal_type as MealType];
  }
  return [];
}

/** Skip plan meals for a date (and refund open plan orders). */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const body = await req.json();
  const cancelDate = body.cancel_date as string;
  if (!cancelDate) return error("cancel_date required");

  const mealTypes = parseMeals(body);
  if (!mealTypes.length) return error("Select at least one meal");

  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  if (cancelDate < dateStr) return error("Cannot cancel a past date");

  const cancelled: string[] = [];
  const skipped: string[] = [];
  let refundedOrders = 0;

  for (const mealType of mealTypes) {
    const active = await query(
      `select 1 from fixed_plans where student_id = $1 and meal_type = $2 and is_active`,
      [user.id, mealType]
    );
    if (!active.rowCount) {
      skipped.push(`${mealType} (no plan)`);
      continue;
    }

    if (
      cancelDate === dateStr &&
      !isMealOpen(
        mealType,
        {
          breakfast: settings.breakfast_cutoff,
          lunch: settings.lunch_cutoff,
          dinner: settings.dinner_cutoff,
        },
        new Date(),
        settings.timezone
      )
    ) {
      skipped.push(`${mealType} (cutoff passed)`);
      continue;
    }

    await query(
      `insert into plan_cancellations (student_id, meal_type, cancel_date)
       values ($1,$2,$3)
       on conflict (student_id, meal_type, cancel_date) do update set created_at = now()`,
      [user.id, mealType, cancelDate]
    );

    refundedOrders += await cancelOpenOrdersForMealDate({
      studentId: user.id,
      mealType,
      orderDate: cancelDate,
      source: "fixed_plan",
    });

    cancelled.push(mealType);
  }

  if (!cancelled.length) {
    return error(skipped.join("; ") || "Nothing cancelled");
  }

  await notifyUser(
    user.id,
    "Meals skipped",
    `${cancelled.join(", ")} skipped for ${cancelDate}${
      refundedOrders ? ` · ${refundedOrders} order(s) refunded to credit` : ""
    }`,
    { type: "plan_cancelled", meals: cancelled, date: cancelDate }
  );

  return json({
    cancelled,
    skipped,
    cancel_date: cancelDate,
    refunded_orders: refundedOrders,
  });
}

/** Resume previously skipped plan meals for a date. */
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);

  let body: { cancel_date?: string; meal_types?: unknown; meal_type?: unknown } =
    {};
  try {
    body = await req.json();
  } catch {
    /* allow query params */
  }
  const cancelDate =
    body.cancel_date || req.nextUrl.searchParams.get("cancel_date") || "";
  if (!cancelDate) return error("cancel_date required");

  const mealTypes =
    parseMeals(body).length > 0
      ? parseMeals(body)
      : parseMeals({
          meal_type: req.nextUrl.searchParams.get("meal_type"),
          meal_types: undefined,
        });

  if (!mealTypes.length) return error("Select at least one meal");

  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  if (cancelDate < dateStr) return error("Cannot change a past date");

  const resumed: string[] = [];
  const blocked: string[] = [];

  for (const mealType of mealTypes) {
    if (
      cancelDate === dateStr &&
      !isMealOpen(
        mealType,
        {
          breakfast: settings.breakfast_cutoff,
          lunch: settings.lunch_cutoff,
          dinner: settings.dinner_cutoff,
        },
        new Date(),
        settings.timezone
      )
    ) {
      blocked.push(`${mealType} (cutoff passed)`);
      continue;
    }

    const { rowCount } = await query(
      `delete from plan_cancellations
       where student_id = $1 and meal_type = $2 and cancel_date = $3::date`,
      [user.id, mealType, cancelDate]
    );
    if (rowCount) resumed.push(mealType);
    else blocked.push(`${mealType} (not skipped)`);
  }

  if (!resumed.length) {
    return error(blocked.join("; ") || "Nothing resumed");
  }

  await notifyUser(
    user.id,
    "Meals resumed",
    `${resumed.join(", ")} back on for ${cancelDate}`,
    { type: "plan_resumed", meals: resumed, date: cancelDate }
  );

  return json({
    resumed,
    blocked,
    cancel_date: cancelDate,
  });
}
