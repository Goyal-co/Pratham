import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  if (user.role !== "student") return error("Students only", 403);

  const acct = await query(
    `select * from student_accounts where student_id = $1`,
    [user.id]
  );
  const ledger = await query(
    `select * from ledger_entries where student_id = $1 order by created_at desc limit 40`,
    [user.id]
  );
  return json({ account: acct.rows[0], ledger: ledger.rows });
}
