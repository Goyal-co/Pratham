import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

/**
 * Register a push target.
 * - Expo: { token: "ExponentPushToken[...]", platform: "ios"|"android" }
 * - Web PWA: { subscription: PushSubscriptionJSON, platform: "web" }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  const body = await req.json();

  let token = body.token as string | undefined;
  let platform = (body.platform as string | undefined) || null;

  if (body.subscription) {
    token = JSON.stringify(body.subscription);
    platform = "web";
  }
  if (!token) return error("token or subscription required");

  const { rows } = await query(
    `insert into push_tokens (user_id, token, platform, updated_at)
     values ($1,$2,$3,now())
     on conflict (user_id, token) do update set platform = excluded.platform, updated_at = now()
     returning id, platform, updated_at`,
    [user.id, token, platform]
  );
  return json({ token: rows[0] });
}
