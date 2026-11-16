import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  getZonedParts,
  isMealOpen,
  type MealType,
  type MenuItem,
} from "@pratham/shared";

export const SERVING_WINDOWS: Record<MealType, string> = {
  breakfast: "7 AM – 9 AM",
  lunch: "12 PM – 2 PM",
  dinner: "7 PM – 9 PM",
};

export function addDaysYmd(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function weekdayLong(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function weekdayShort(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function greetingForNow(now = new Date()) {
  const { minutes } = getZonedParts(now);
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

export function formatCutoffLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: m ? "2-digit" : undefined,
    hour12: true,
    timeZone: "UTC",
  });
}

export function deliveryLine(hostel?: string | null, room?: string | null) {
  const place = (hostel || "").trim() || "Your PG";
  const rm = (room || "").trim();
  return rm ? `${place} · Room ${rm}` : place;
}

export function initialsOf(name?: string | null) {
  const parts = (name || "A").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Next orderable meal: today if open + menu, else tomorrow's first meal with menu. */
export function nextOrderableMeal(input: {
  now?: Date;
  today: string;
  tomorrow: string;
  cutoffs?: Record<MealType, string>;
  todayItems: MenuItem[];
  tomorrowItems: MenuItem[];
}): {
  meal: MealType;
  orderDate: string;
  label: string;
  item: MenuItem | null;
  cutoff: string;
  forTomorrow: boolean;
} | null {
  const now = input.now ?? new Date();
  const cutoffs = input.cutoffs ?? DEFAULT_CUTOFFS;
  const meals: MealType[] = ["breakfast", "lunch", "dinner"];

  for (const meal of meals) {
    if (!isMealOpen(meal, cutoffs, now)) continue;
    const list = input.todayItems.filter((i) => i.meal_type === meal);
    if (!list.length) continue;
    return {
      meal,
      orderDate: input.today,
      label: `${weekdayLong(input.today)} ${MEAL_LABELS[meal]}`,
      item: list[0],
      cutoff: cutoffs[meal],
      forTomorrow: false,
    };
  }

  for (const meal of meals) {
    const list = input.tomorrowItems.filter((i) => i.meal_type === meal);
    if (!list.length) continue;
    return {
      meal,
      orderDate: input.tomorrow,
      label: `Tomorrow's ${MEAL_LABELS[meal]}`,
      item: list[0],
      cutoff: cutoffs[meal],
      forTomorrow: true,
    };
  }

  return null;
}

export function mealTone(meal: MealType): "breakfast" | "lunch" | "dinner" {
  return meal;
}
