import { query } from "@pratham/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendExpoPush(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (!userIds.length) return { pushes: 0 };
  const { rows } = await query<{ token: string }>(
    `select token from push_tokens where user_id = any($1::uuid[])`,
    [userIds]
  );
  if (!rows.length) return { pushes: 0 };

  const messages = rows.map((r) => ({
    to: r.token,
    sound: "default",
    title,
    body,
    data: data ?? {},
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  const expo = await res.json().catch(() => null);
  return { pushes: messages.length, expo };
}
