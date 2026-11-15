import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/services";

/** Legacy endpoint — prefer POST /collect. Sets wallet to an absolute value. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const { id } = await ctx.params;
  const body = await req.json();
  const newWallet = Number(body.wallet_credit ?? body.new_balance ?? 0);
  if (!Number.isFinite(newWallet)) return error("Invalid wallet value");

  const prev = await query(
    `select wallet_credit, credit_limit from student_accounts where student_id = $1`,
    [id]
  );
  if (!prev.rows[0]) return error("Student not found", 404);
  const old = Number(prev.rows[0].wallet_credit);
  const limit = Number(prev.rows[0].credit_limit);
  if (newWallet < -limit) {
    return error(`Wallet cannot go below -credit limit (−${limit})`);
  }

  const { rows } = await query(
    `update student_accounts
     set wallet_credit = $1, outstanding_balance = 0, updated_at = now()
     where student_id = $2 returning *`,
    [newWallet, id]
  );

  const note = body.note || `Wallet set from ${old} to ${newWallet}`;
  await query(
    `insert into ledger_entries (student_id, entry_type, amount, note, created_by)
     values ($1,'adjustment',$2,$3,$4)`,
    [id, newWallet - old, note, user.id]
  );

  await writeAudit({
    actorId: user.id,
    action: "wallet.set",
    entity: "student_account",
    entityId: id,
    before: { wallet_credit: old },
    after: { wallet_credit: newWallet },
    note,
  });

  await notifyUser(
    id,
    "Wallet updated",
    `Your wallet is now ₹${newWallet}`,
    { type: "wallet_updated", wallet_credit: newWallet }
  );

  return json({ account: rows[0] });
}
