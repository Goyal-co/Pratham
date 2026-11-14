import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getSettings, notifyUser } from "@/lib/services";
import { isMealOpen, type MealType } from "@pratham/shared";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const studentId =
    user.role === "admin"
      ? req.nextUrl.searchParams.get("student_id") || user.id
      : user.id;
  const { rows } = await query(
    `select * from fixed_plans where student_id = $1 and is_active = true`,
    [studentId]
  );
  return json({ plans: rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const body = await req.json();
  const mealType = body.meal_type as MealType;

  await query(
    `update fixed_plans set is_active = false, ended_at = now()
     where student_id = $1 and meal_type = $2 and is_active`,
    [user.id, mealType]
  );
  const { rows } = await query(
    `insert into fixed_plans (student_id, meal_type, menu_item_id, is_active)
     values ($1,$2,$3,true) returning *`,
    [user.id, mealType, body.menu_item_id || null]
  );
  await notifyUser(
    user.id,
    "Fixed plan activated",
    `You will receive ${mealType} every day unless you cancel before cutoff.`,
    { type: "plan_activated", plan_id: rows[0].id }
  );
  return json({ plan: rows[0] });
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
  return json({ ok: true });
}
