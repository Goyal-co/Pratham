import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const { rows } = await query(
    `select u.id, u.full_name, u.phone, u.hostel, u.room, u.referral_code, u.email, u.created_at,
            sa.credit_limit, sa.outstanding_balance, sa.wallet_credit,
            coalesce(
              (select json_agg(json_build_object('meal_type', fp.meal_type, 'is_active', fp.is_active))
               from fixed_plans fp where fp.student_id = u.id and fp.is_active),
              '[]'::json
            ) as fixed_plans
     from users u
     left join student_accounts sa on sa.student_id = u.id
     where u.role = 'student'
     order by u.created_at desc`
  );
  return json({ students: rows });
}
