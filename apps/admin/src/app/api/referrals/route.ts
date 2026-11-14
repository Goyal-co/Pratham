import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);

  if (user.role === "admin") {
    const { rows } = await query(
      `select r.*,
              inv.full_name as inviter_name, inv.referral_code as inviter_code,
              invee.full_name as invitee_name
       from referrals r
       join users inv on inv.id = r.inviter_id
       join users invee on invee.id = r.invitee_id
       order by r.created_at desc`
    );
    return json({ referrals: rows });
  }

  const { rows } = await query(
    `select * from referrals where inviter_id = $1 order by created_at desc`,
    [user.id]
  );
  return json({ referrals: rows });
}
