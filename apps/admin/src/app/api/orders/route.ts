import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { placeOrder } from "@/lib/services";
import { getZonedParts } from "@pratham/shared";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const date =
    req.nextUrl.searchParams.get("date") ||
    getZonedParts().dateStr;

  if (user.role === "admin") {
    const { rows } = await query(
      `select o.*, u.full_name, u.phone
       from orders o
       join users u on u.id = o.student_id
       where o.order_date = $1
       order by o.created_at desc`,
      [date]
    );
    return json({ orders: rows });
  }

  const { rows } = await query(
    `select o.*, mi.name as item_name, mi.name as menu_item_name
     from orders o
     left join menu_items mi on mi.id = o.menu_item_id
     where o.student_id = $1
     order by o.created_at desc
     limit 50`,
    [user.id]
  );
  return json({ orders: rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);
  const body = await req.json();
  try {
    const order = await placeOrder({
      studentId: user.id,
      mealType: body.meal_type,
      menuItemId: body.menu_item_id,
      quantity: Number(body.quantity || 1),
      notes: body.notes,
      orderDate: body.order_date,
      source: "adhoc",
    });
    return json({ order });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Order failed");
  }
}
