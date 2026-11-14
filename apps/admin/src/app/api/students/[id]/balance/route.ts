import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/services";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const { id } = await ctx.params;
  const body = await req.json();
  const newBalance = Number(body.new_balance ?? 0);
  if (newBalance < 0) return error("Balance cannot be negative");

  const prev = await query(
    `select outstanding_balance from student_accounts where student_id = $1`,
    [id]
  );
  if (!prev.rows[0]) return error("Student not found", 404);
  const old = Number(prev.rows[0].outstanding_balance);

  const { rows } = await query(
    `update student_accounts set outstanding_balance = $1, updated_at = now()
     where student_id = $2 returning *`,
    [newBalance, id]
  );

  const note = body.note || `Balance set from ${old} to ${newBalance}`;
  await query(
    `insert into ledger_entries (student_id, entry_type, amount, note, created_by)
     values ($1,'cod_collection',$2,$3,$4)`,
    [id, old - newBalance, note, user.id]
  );

  await writeAudit({
    actorId: user.id,
    action: "balance.set",
    entity: "student_account",
    entityId: id,
    before: { outstanding_balance: old },
    after: { outstanding_balance: newBalance },
    note,
  });

  await notifyUser(
    id,
    "Balance updated",
    `Your outstanding balance is now ₹${newBalance}`,
    { type: "balance_cleared", balance: newBalance }
  );

  return json({ account: rows[0] });
}
