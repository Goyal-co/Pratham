import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const body = await req.json();
  if (!body.token) return error("token required");
  const { rows } = await query(
    `insert into push_tokens (user_id, token, platform, updated_at)
     values ($1,$2,$3,now())
     on conflict (user_id, token) do update set platform = excluded.platform, updated_at = now()
     returning *`,
    [user.id, body.token, body.platform || null]
  );
  return json({ token: rows[0] });
}
