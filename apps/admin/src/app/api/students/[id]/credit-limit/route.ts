import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const { id } = await ctx.params;
  const body = await req.json();
  const prev = await query(
    `select credit_limit from student_accounts where student_id = $1`,
    [id]
  );
  if (!prev.rows[0]) return error("Student not found", 404);
  const oldLimit = Number(prev.rows[0].credit_limit);
  const newLimit = Number(body.credit_limit);
  const { rows } = await query(
    `update student_accounts set credit_limit = $1, updated_at = now()
     where student_id = $2 returning *`,
    [newLimit, id]
  );
  await writeAudit({
    actorId: user.id,
    action: "credit_limit.set",
    entity: "student_account",
    entityId: id,
    before: { credit_limit: oldLimit },
    after: { credit_limit: newLimit },
  });
  return json({ account: rows[0] });
}
