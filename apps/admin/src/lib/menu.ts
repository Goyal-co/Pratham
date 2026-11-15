import { query } from "@pratham/db";

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

/** Day-specific dishes only (no catalog merge). */
export async function getDaySpecificMenu(menuDate: string) {
  const { rows } = await query(
    `select * from menu_items
     where is_active and menu_date = $1::date
     order by meal_type, name`,
    [menuDate]
  );
  return rows.map(normalizeItem);
}

/**
 * Menu for a calendar day — only dishes added for that date.
 * Catalog defaults are admin-only fallbacks for kitchen auto-pick, not shown to students.
 */
export async function getMenuForDate(menuDate: string) {
  return getDaySpecificMenu(menuDate);
}

export async function getCatalogMenu() {
  const { rows } = await query(
    `select * from menu_items
     where is_active and menu_date is null
     order by meal_type, name`
  );
  return rows.map(normalizeItem);
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
