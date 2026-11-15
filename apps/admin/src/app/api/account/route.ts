import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { creditAvailable, debtFromWallet } from "@pratham/shared";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  if (user.role !== "student") return error("Students only", 403);

  const acct = await query(
    `select credit_limit, wallet_credit, updated_at from student_accounts where student_id = $1`,
    [user.id]
  );
  const ledger = await query(
    `select * from ledger_entries where student_id = $1 order by created_at desc limit 80`,
    [user.id]
  );
  const row = acct.rows[0];
  const wallet = Number(row?.wallet_credit ?? 0);
  const limit = Number(row?.credit_limit ?? 0);

  return json({
    account: row
      ? {
          credit_limit: limit,
          wallet_credit: wallet,
          debt: debtFromWallet(wallet),
          credit_available: creditAvailable(wallet, limit),
          updated_at: row.updated_at,
        }
      : null,
    ledger: ledger.rows,
  });
}
