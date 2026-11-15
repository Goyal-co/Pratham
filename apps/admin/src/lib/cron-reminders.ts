import { query } from "@pratham/db";
import {
  getZonedParts,
  MEAL_LABELS,
  minutesUntilCutoff,
  timeToMinutes,
  type MealType,
} from "@pratham/shared";
import { getSettings, notifyAllStudents } from "@/lib/services";
import { summarizeMenu } from "@/lib/menu";

/** Opening windows are wider so sparse Hobby crons (few/day) still hit. */
const OPENING_WINDOW_MIN = 45;
const EVENING_WINDOW_MIN = 30;

async function alreadySent(
  kind: string,
  refDate: string,
  meal: MealType | "" = ""
) {
  const { rowCount } = await query(
    `insert into reminder_log (kind, ref_date, meal_key)
     values ($1, $2::date, $3)
     on conflict (kind, ref_date, meal_key) do nothing
     returning id`,
    [kind, refDate, meal || ""]
  );
  return !rowCount;
}

export async function runReminders() {
  const settings = await getSettings();
  const tz = settings.timezone || "Asia/Kolkata";
  const now = new Date();
  const { dateStr, minutes } = getZonedParts(now, tz);
  const lead = Math.max(
    10,
    Number(
      (settings as { reminder_lead_minutes?: number }).reminder_lead_minutes ??
        30
    )
  );
  const cutoffs = {
    breakfast: settings.breakfast_cutoff,
    lunch: settings.lunch_cutoff,
    dinner: settings.dinner_cutoff,
  } as Record<MealType, string>;

  const sent: string[] = [];

  for (const meal of ["breakfast", "lunch", "dinner"] as MealType[]) {
    const until = minutesUntilCutoff(meal, cutoffs, now, tz);
    if (until > 0 && until <= lead) {
      const kind = `closing_${meal}`;
      if (!(await alreadySent(kind, dateStr, meal))) {
        const label = MEAL_LABELS[meal];
        await notifyAllStudents(
          `${label} closing soon`,
          `Order acceptance for ${label} closes at ${cutoffs[meal]} IST (${until} min left).`,
          {
            type: "order_closing",
            meal,
            cutoff: cutoffs[meal],
            minutes_left: until,
          }
        );
        sent.push(kind);
      }
    }
  }

  {
    const bCut = timeToMinutes(cutoffs.breakfast);
    if (minutes >= bCut && minutes < bCut + OPENING_WINDOW_MIN) {
      const kind = "opening_lunch";
      if (!(await alreadySent(kind, dateStr, "lunch"))) {
        await notifyAllStudents(
          "Lunch ordering is open",
          `Lunch orders accepted until ${cutoffs.lunch} IST.`,
          { type: "order_opening", meal: "lunch", cutoff: cutoffs.lunch }
        );
        sent.push(kind);
      }
    }
  }

  {
    const lCut = timeToMinutes(cutoffs.lunch);
    if (minutes >= lCut && minutes < lCut + OPENING_WINDOW_MIN) {
      const kind = "opening_dinner";
      if (!(await alreadySent(kind, dateStr, "dinner"))) {
        await notifyAllStudents(
          "Dinner ordering is open",
          `Dinner orders accepted until ${cutoffs.dinner} IST.`,
          { type: "order_opening", meal: "dinner", cutoff: cutoffs.dinner }
        );
        sent.push(kind);
      }
    }
  }

  // 20:00 IST: prefer tomorrow-menu if published; else breakfast opening
  if (minutes >= 20 * 60 && minutes < 20 * 60 + EVENING_WINDOW_MIN) {
    const tomorrow = getZonedParts(
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
      tz
    ).dateStr;
    const pub = await query(
      `select 1 from menu_day_pubs where menu_date = $1::date`,
      [tomorrow]
    );

    if (pub.rowCount) {
      const kind = "menu_tomorrow";
      if (!(await alreadySent(kind, tomorrow, ""))) {
        const summary = await summarizeMenu(tomorrow);
        await notifyAllStudents(
          `Tomorrow's menu (${tomorrow})`,
          summary.length > 160 ? `${summary.slice(0, 157)}…` : summary,
          { type: "menu_reminder", date: tomorrow }
        );
        sent.push(kind);
      }
    } else {
      const kind = "opening_breakfast";
      if (!(await alreadySent(kind, tomorrow, "breakfast"))) {
        await notifyAllStudents(
          "Breakfast ordering opens overnight",
          `Tomorrow's breakfast orders are accepted until ${cutoffs.breakfast} IST. Check the menu and plan ahead.`,
          {
            type: "order_opening",
            meal: "breakfast",
            date: tomorrow,
            cutoff: cutoffs.breakfast,
          }
        );
        sent.push(kind);
      }
    }
  }

  return { date: dateStr, minutes, lead, sent };
}
