import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getSettings, notifyUser } from "@/lib/services";
import { getZonedParts, isMealOpen, type MealType } from "@pratham/shared";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const body = await req.json();
  const cancelDate = body.cancel_date as string;
  if (!cancelDate) return error("cancel_date required");

  const mealTypes: MealType[] = Array.isArray(body.meal_types)
    ? body.meal_types.filter((m: string) => MEALS.includes(m as MealType))
    : body.meal_type
      ? [body.meal_type as MealType]
      : [];

  if (!mealTypes.length) return error("Select at least one meal");

  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  if (cancelDate < dateStr) return error("Cannot cancel a past date");

  const cancelled: string[] = [];
  const skipped: string[] = [];

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
    cancelled.push(mealType);
  }

  if (!cancelled.length) {
    return error(skipped.join("; ") || "Nothing cancelled");
  }

  await notifyUser(
    user.id,
    "Meals skipped",
    `${cancelled.join(", ")} skipped for ${cancelDate}`,
    { type: "plan_cancelled", meals: cancelled, date: cancelDate }
  );

  return json({ cancelled, skipped, cancel_date: cancelDate });
}
