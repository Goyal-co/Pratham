import { query } from "@pratham/db";

type WebPush = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: unknown,
    payload: string
  ) => Promise<unknown>;
};

function loadWebPush(): WebPush | null {
  try {
    // CJS package — ESM default import is undefined under Next interop
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("web-push");
    return (mod?.setVapidDetails ? mod : mod?.default) as WebPush;
  } catch {
    return null;
  }
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function configureWebPush(webpush: WebPush) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@gmail.com";
    if (!publicKey || !privateKey) return false;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    return false;
  }
}

function isWebSubscription(token: string) {
  if (!token.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(token) as { endpoint?: string };
    return !!parsed.endpoint;
  } catch {
    return false;
  }
}

export async function sendExpoPush(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (!userIds.length) return { pushes: 0, web: 0, expo: 0 };
  const { rows } = await query<{ token: string; platform: string | null }>(
    `select token, platform from push_tokens where user_id = any($1::uuid[])`,
    [userIds]
  );
  if (!rows.length) return { pushes: 0, web: 0, expo: 0 };

  const webpush = loadWebPush();
  const webConfigured = webpush ? configureWebPush(webpush) : false;
  let webSent = 0;
  let expoSent = 0;
  const expoMessages: unknown[] = [];

  for (const row of rows) {
    if (isWebSubscription(row.token) || row.platform === "web") {
      if (!webConfigured || !webpush) continue;
      try {
        const sub = JSON.parse(row.token);
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title, body, data: data ?? {} })
        );
        webSent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await query(`delete from push_tokens where token = $1`, [row.token]);
        }
      }
      continue;
    }

    expoMessages.push({
      to: row.token,
      sound: "default",
      title,
      body,
      data: data ?? {},
    });
  }

  if (expoMessages.length) {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(expoMessages),
    }).catch(() => null);
    expoSent = expoMessages.length;
  }

  return { pushes: webSent + expoSent, web: webSent, expo: expoSent };
}
