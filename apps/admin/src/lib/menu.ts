import { query } from "@pratham/db";
import type { MealType } from "@pratham/shared";

/** Normalize pg date / Date / ISO string → YYYY-MM-DD (IST calendar intent). */
export function asDateStr(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(d);
    }
    return null;
  }
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(value);
  }
  return null;
}

function normalizeItem<T extends { menu_date?: unknown }>(row: T) {
  return { ...row, menu_date: asDateStr(row.menu_date) };
}

/**
 * Menu for a calendar day:
 * - If day-specific items exist for a meal, use those
 * - Otherwise fall back to catalog items (menu_date is null)
 */
export async function getMenuForDate(menuDate: string) {
  const { rows: dated } = await query(
    `select * from menu_items
     where is_active and menu_date = $1::date
     order by meal_type, name`,
    [menuDate]
  );
  const mealsWithDated = new Set(dated.map((r) => r.meal_type as MealType));

  const { rows: catalog } = await query(
    `select * from menu_items
     where is_active and menu_date is null
     order by meal_type, name`
  );

  const fallback = catalog.filter(
    (r) => !mealsWithDated.has(r.meal_type as MealType)
  );
  return [...dated, ...fallback].map(normalizeItem);
}

export async function summarizeMenu(menuDate: string) {
  const items = await getMenuForDate(menuDate);
  const byMeal: Record<string, string[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
  };
  for (const i of items) {
    byMeal[i.meal_type as string]?.push(String(i.name));
  }
  const parts = (["breakfast", "lunch", "dinner"] as const)
    .map((m) => {
      const names = byMeal[m];
      if (!names.length) return null;
      return `${m[0].toUpperCase()}${m.slice(1)}: ${names.join(", ")}`;
    })
    .filter(Boolean);
  return parts.join(" · ") || "Menu updated";
}
