import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const { rows } = await query(
    `select * from notifications where user_id = $1 order by created_at desc limit 50`,
    [user.id]
  );
  return json({ notifications: rows });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const body = await req.json();
  if (!body.id) return error("id required");
  await query(
    `update notifications set read_at = now() where id = $1 and user_id = $2`,
    [body.id, user.id]
  );
  return json({ ok: true });
}
