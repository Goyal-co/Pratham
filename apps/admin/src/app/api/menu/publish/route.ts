import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { notifyAllStudents } from "@/lib/services";
import { summarizeMenu } from "@/lib/menu";
import { writeAudit } from "@/lib/audit";

/**
 * Publish a day's menu and optionally push-notify all students.
 * Body: { date: "YYYY-MM-DD", notify?: boolean }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const body = await req.json();
  const date = String(body.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error("date must be YYYY-MM-DD");
  }

  await query(
    `insert into menu_day_pubs (menu_date, published_at, published_by)
     values ($1::date, now(), $2)
     on conflict (menu_date) do update set
       published_at = now(),
       published_by = excluded.published_by`,
    [date, user.id]
  );

  const summary = await summarizeMenu(date);
  let notify = { recipients: 0, pushes: 0 };
  if (body.notify !== false) {
    const title = `Menu for ${date}`;
    const bodyText =
      summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
    notify = await notifyAllStudents(title, bodyText, {
      type: "menu_published",
      date,
    });
    await query(
      `update menu_day_pubs set notify_sent_at = now() where menu_date = $1::date`,
      [date]
    );
  }

  await writeAudit({
    actorId: user.id,
    action: "menu.publish",
    entity: "menu_day",
    entityId: date,
    after: { date, summary, notify },
  });

  return json({ ok: true, date, summary, notify });
}
