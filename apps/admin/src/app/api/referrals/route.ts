import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getSettings } from "@/lib/services";
import { formatInr } from "@pratham/shared";

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

  const settings = await getSettings();
  const reward = Number(settings.referral_reward_credits);
  const minOrders = Number(settings.referral_min_completed_orders);

  const [refs, credits] = await Promise.all([
    query(
      `select r.id, r.status, r.completed_orders, r.earned_at, r.created_at,
              u.full_name as invitee_name, u.email as invitee_email
       from referrals r
       join users u on u.id = r.invitee_id
       where r.inviter_id = $1
       order by r.created_at desc`,
      [user.id]
    ),
    query(
      `select coalesce(sum(amount), 0)::float as total
       from ledger_entries
       where student_id = $1 and entry_type = 'referral_credit'`,
      [user.id]
    ),
  ]);

  const referrals = refs.rows.map((r) => ({
    id: r.id as string,
    invitee_name: (r.invitee_name as string | null) || "Friend",
    invitee_email: r.invitee_email as string | null,
    status: r.status as string,
    completed_orders: Number(r.completed_orders || 0),
    needed_orders: minOrders,
    earned_at: r.earned_at as string | null,
    created_at: r.created_at as string,
  }));

  const pending = referrals.filter((r) => r.status === "pending").length;
  const earned = referrals.filter((r) => r.status === "earned").length;
  const creditsEarned = Number(credits.rows[0]?.total || 0);

  return json({
    code: user.referral_code,
    campaign: {
      title: "Refer & Earn",
      headline: `Earn ${formatInr(reward)} for every friend who joins`,
      description:
        "Share your invite code. When your friend signs up with it and completes their first meals, you get wallet credit automatically.",
      reward_credits: reward,
      min_completed_orders: minOrders,
      steps: [
        "Share your unique referral code with a classmate or roommate.",
        "They create an Ahariva account and enter your code at signup.",
        `When they complete ${minOrders} delivered meal${minOrders === 1 ? "" : "s"}, you earn ${formatInr(reward)} wallet credit.`,
        "Credits appear in Wallet & Payments and can be used on future orders.",
      ],
      rules: [
        "One referral code per account — yours is unique.",
        "Self-referrals are not allowed.",
        `Reward unlocks after ${minOrders} delivered order${minOrders === 1 ? "" : "s"} by your friend.`,
        "Pending invites stay open until the order goal is met.",
        "Credits are added to your wallet balance (not cash).",
      ],
    },
    summary: {
      invited: referrals.length,
      pending,
      earned,
      credits_earned: creditsEarned,
      reward_per_friend: reward,
    },
    referrals,
  });
}
