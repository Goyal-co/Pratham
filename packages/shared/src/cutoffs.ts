import type { MealType } from "./types";

export const DEFAULT_CUTOFFS: Record<MealType, string> = {
  breakfast: "06:00",
  lunch: "11:00",
  dinner: "17:00",
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

/** Parse HH:mm into minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Current date/time parts in a given IANA timezone (default Asia/Kolkata).
 */
export function getZonedParts(
  date: Date = new Date(),
  timeZone = "Asia/Kolkata"
): { dateStr: string; minutes: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
    weekday: weekdayMap[parts.weekday ?? "Mon"] ?? 1,
  };
}

export function isMealOpen(
  meal: MealType,
  cutoffs: Record<MealType, string>,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata"
): boolean {
  const { minutes } = getZonedParts(now, timeZone);
  return minutes < timeToMinutes(cutoffs[meal]);
}

export function getOpenMeals(
  cutoffs: Record<MealType, string>,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata"
): MealType[] {
  return MEAL_ORDER.filter((m) => isMealOpen(m, cutoffs, now, timeZone));
}

export function minutesUntilCutoff(
  meal: MealType,
  cutoffs: Record<MealType, string>,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata"
): number {
  const { minutes } = getZonedParts(now, timeZone);
  return timeToMinutes(cutoffs[meal]) - minutes;
}

export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) return "Closed";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m left`;
  return `${h}h ${m}m left`;
}
