import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getZonedParts } from "@pratham/shared";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getStudentHistory } from "@/lib/history";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const { id } = await ctx.params;
  const student = await query(
    `select id, full_name, email, phone, hostel, room, referral_code
     from users where id = $1 and role = 'student'`,
    [id]
  );
  if (!student.rows[0]) return error("Student not found", 404);

  const { dateStr } = getZonedParts();
  const month =
    req.nextUrl.searchParams.get("month") || dateStr.slice(0, 7);
  const meal = req.nextUrl.searchParams.get("meal");
  const status = req.nextUrl.searchParams.get("status");
  const source = req.nextUrl.searchParams.get("source");
  const date = req.nextUrl.searchParams.get("date");
  const entryType = req.nextUrl.searchParams.get("entry_type");

  if (!/^\d{4}-\d{2}$/.test(month)) return error("month must be YYYY-MM");

  const history = await getStudentHistory({
    studentId: id,
    month,
    meal,
    status,
    source,
    date,
    entryType,
  });

  return json({ student: student.rows[0], ...history });
}
