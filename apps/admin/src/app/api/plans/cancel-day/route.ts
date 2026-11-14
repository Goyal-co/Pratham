import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getSettings, notifyUser } from "@/lib/services";
import { getZonedParts, isMealOpen, type MealType } from "@pratham/shared";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const body = await req.json();
  const mealType = body.meal_type as MealType;
  const cancelDate = body.cancel_date as string;

  const active = await query(
    `select 1 from fixed_plans where student_id = $1 and meal_type = $2 and is_active`,
    [user.id, mealType]
  );
  if (!active.rowCount) return error(`No active fixed plan for ${mealType}`);

  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone);
  if (cancelDate < dateStr) return error("Cannot cancel a past date");
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
    return error(`Cutoff passed; cannot cancel ${mealType} for today`);
  }

  const { rows } = await query(
    `insert into plan_cancellations (student_id, meal_type, cancel_date)
     values ($1,$2,$3)
     on conflict (student_id, meal_type, cancel_date) do update set created_at = now()
     returning *`,
    [user.id, mealType, cancelDate]
  );
  await notifyUser(
    user.id,
    "Plan meal cancelled",
    `${mealType} cancelled for ${cancelDate}`,
    { type: "plan_cancelled", meal_type: mealType, date: cancelDate }
  );
  return json({ cancellation: rows[0] });
}
