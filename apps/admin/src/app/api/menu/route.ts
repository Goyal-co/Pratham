import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getZonedParts } from "@pratham/shared";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { asDateStr, getMenuForDate } from "@/lib/menu";

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const all = req.nextUrl.searchParams.get("all") === "1";
  const { dateStr } = getZonedParts();
  const menuDate = dateParam || dateStr;

  if (all) {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== "admin") return error("Admin only", 403);
    const { rows } = await query(
      `select * from menu_items order by menu_date nulls first, meal_type, name`
    );
    return json({ items: rows, date: menuDate });
  }

  const items = await getMenuForDate(menuDate);
  const pub = await query(
    `select * from menu_day_pubs where menu_date = $1::date`,
    [menuDate]
  );
  return json({
    items,
    date: menuDate,
    published: !!pub.rows[0],
    published_at: pub.rows[0]?.published_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const body = await req.json();
  if (!body.meal_type || !body.name) return error("meal_type and name required");

  const menuDate =
    body.menu_date === "" || body.menu_date == null
      ? null
      : String(body.menu_date);

  const { rows } = await query(
    `insert into menu_items (meal_type, name, description, price, is_active, menu_date)
     values ($1,$2,$3,$4,true,$5::date) returning *`,
    [
      body.meal_type,
      body.name,
      body.description || null,
      Number(body.price),
      menuDate,
    ]
  );
  const item = rows[0];
  return json({
    item: { ...item, menu_date: asDateStr(item.menu_date) },
  });
}
