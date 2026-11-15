import { NextRequest } from "next/server";
import { query, withTransaction } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/services";
import { debtFromWallet } from "@pratham/shared";

/**
 * Record cash paid by student → always credits wallet.
 * Negative wallet (debt) moves toward zero; surplus stays as prepaid.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const { id } = await ctx.params;
  const body = await req.json();
  const amountPaid = Number(body.amount_paid);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return error("amount_paid must be a positive number");
  }

  const note = (body.note as string) || "Cash collected";

  const result = await withTransaction(async (client) => {
    const prev = await client.query(
      `select wallet_credit, credit_limit from student_accounts
       where student_id = $1 for update`,
      [id]
    );
    if (!prev.rows[0]) throw new Error("Student not found");

    const oldWallet = Number(prev.rows[0].wallet_credit);
    const newWallet = oldWallet + amountPaid;
    const debtBefore = debtFromWallet(oldWallet);
    const debtAfter = debtFromWallet(newWallet);
    const clearedDebt = debtBefore - debtAfter;
    const prepaidAdded = Math.max(0, amountPaid - clearedDebt);

    const updated = await client.query(
      `update student_accounts
       set wallet_credit = $1,
           outstanding_balance = 0,
           updated_at = now()
       where student_id = $2
       returning *`,
      [newWallet, id]
    );

    await client.query(
      `insert into ledger_entries (student_id, entry_type, amount, note, created_by)
       values ($1,'cod_collection',$2,$3,$4)`,
      [
        id,
        amountPaid,
        `${note} · wallet ${oldWallet.toFixed(0)} → ${newWallet.toFixed(0)}` +
          (prepaidAdded > 0 ? ` · prepaid ₹${prepaidAdded}` : ""),
        user.id,
      ]
    );

    return {
      account: updated.rows[0],
      amount_paid: amountPaid,
      cleared_debt: clearedDebt,
      prepaid_added: prepaidAdded,
      before: { wallet_credit: oldWallet },
      after: { wallet_credit: newWallet },
    };
  });

  await writeAudit({
    actorId: user.id,
    action: "cash.collect",
    entity: "student_account",
    entityId: id,
    before: result.before,
    after: result.after,
    note,
  });

  await notifyUser(
    id,
    "Payment recorded",
    `Paid ₹${result.amount_paid}. Wallet now ₹${Number(result.account.wallet_credit).toFixed(0)}.`,
    {
      type: "cash_collected",
      amount_paid: result.amount_paid,
      wallet_credit: Number(result.account.wallet_credit),
    }
  );

  return json(result);
}
