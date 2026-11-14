import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { sendExpoPush } from "@/lib/push";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const body = await req.json();
  if (!body.title || !body.body) return error("title and body required");

  const { rows } = await query(`select id from users where role = 'student'`);
  const ids = rows.map((r) => r.id as string);
  if (ids.length) {
    await query(
      `insert into notifications (user_id, title, body, data)
       select id, $1, $2, $3 from users where role = 'student'`,
      [body.title, body.body, JSON.stringify({ type: "broadcast" })]
    );
  }
  const result = await sendExpoPush(ids, body.title, body.body, {
    type: "broadcast",
  });
  return json({ recipients: ids.length, ...result });
}
