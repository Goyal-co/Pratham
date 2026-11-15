import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { asDateStr } from "@/lib/menu";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const { id } = await ctx.params;
  if (!id) return error("id required");

  const body = await req.json();
  const mealType = body.meal_type as string | undefined;
  const name = body.name as string | undefined;
  const description =
    body.description === undefined ? undefined : (body.description as string | null);
  const price = body.price === undefined ? undefined : Number(body.price);
  const menuDate =
    body.menu_date === undefined
      ? undefined
      : body.menu_date === "" || body.menu_date == null
        ? null
        : String(body.menu_date);
  const isActive =
    body.is_active === undefined ? undefined : Boolean(body.is_active);

  if (name !== undefined && !String(name).trim()) {
    return error("name cannot be empty");
  }
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    return error("invalid price");
  }
  if (
    mealType !== undefined &&
    !["breakfast", "lunch", "dinner"].includes(mealType)
  ) {
    return error("invalid meal_type");
  }

  const { rows } = await query(
    `update menu_items set
       meal_type = coalesce($2, meal_type),
       name = coalesce($3, name),
       description = case when $4::boolean then $5 else description end,
       price = coalesce($6, price),
       menu_date = case when $7::boolean then $8::date else menu_date end,
       is_active = coalesce($9, is_active)
     where id = $1
     returning *`,
    [
      id,
      mealType ?? null,
      name != null ? String(name).trim() : null,
      description !== undefined,
      description === undefined ? null : description || null,
      price ?? null,
      menuDate !== undefined,
      menuDate ?? null,
      isActive ?? null,
    ]
  );

  if (!rows[0]) return error("Menu item not found", 404);
  return json({
    item: { ...rows[0], menu_date: asDateStr(rows[0].menu_date) },
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const { id } = await ctx.params;
  if (!id) return error("id required");

  const hard = req.nextUrl.searchParams.get("hard") === "1";

  if (hard) {
    const { rowCount } = await query(`delete from menu_items where id = $1`, [id]);
    if (!rowCount) return error("Menu item not found", 404);
    return json({ deleted: true, hard: true });
  }

  const { rows } = await query(
    `update menu_items set is_active = false where id = $1 returning id`,
    [id]
  );
  if (!rows[0]) return error("Menu item not found", 404);
  return json({ deleted: true, hard: false });
}
