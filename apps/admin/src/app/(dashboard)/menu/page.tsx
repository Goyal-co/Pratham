import { query } from "@pratham/db";
import { getZonedParts } from "@pratham/shared";
import { MenuForm } from "./MenuForm";
import { PublishMenuButton } from "./PublishMenuButton";
import { MenuItemActions, type MenuItemRow } from "./MenuItemActions";
import { asDateStr, getDaySpecificMenu } from "@/lib/menu";

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function toRow(item: Record<string, unknown>): MenuItemRow {
  return {
    id: String(item.id),
    meal_type: String(item.meal_type),
    name: String(item.name),
    description: (item.description as string | null) ?? null,
    price: item.price as number | string,
    menu_date: asDateStr(item.menu_date),
  };
}

export default async function MenuPage() {
  const { dateStr: today } = getZonedParts();
  const tomorrow = addDays(today, 1);

  const [todayItems, tomorrowItems, catalog, pubs] = await Promise.all([
    getDaySpecificMenu(today),
    getDaySpecificMenu(tomorrow),
    query(
      `select * from menu_items where menu_date is null and is_active
       order by meal_type, name`
    ),
    query(
      `select * from menu_day_pubs where menu_date in ($1::date, $2::date)`,
      [today, tomorrow]
    ),
  ]);

  const pubMap = Object.fromEntries(
    pubs.rows.map((p) => {
      const key = asDateStr(p.menu_date) || String(p.menu_date).slice(0, 10);
      return [key, p];
    })
  );

  function DayTable({
    title,
    date,
    items,
  }: {
    title: string;
    date: string;
    items: Awaited<ReturnType<typeof getDaySpecificMenu>>;
  }) {
    const pub = pubMap[date];
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>
              {title}{" "}
              <span className="muted" style={{ fontWeight: 500, fontSize: 14 }}>
                {date}
              </span>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {items.length
                ? `${items.length} dish(es) for this day only`
                : "No day dishes yet — add above."}
              {pub ? " · Published" : " · Not published"}
            </p>
          </div>
          <PublishMenuButton date={date} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Name</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <MenuItemActions key={item.id} item={toRow(item)} />
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No items for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Menu</h1>
      <p className="muted">
        Add dishes for a date (usually tomorrow), then publish to notify students.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add dish</h2>
        <MenuForm defaultDate={tomorrow} />
      </div>

      <DayTable title="Tomorrow" date={tomorrow} items={tomorrowItems} />
      <DayTable title="Today" date={today} items={todayItems} />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Catalog defaults</h2>
        <p className="muted">
          Used only when a date has no day-specific dishes yet.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Name</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.rows.map((item) => (
                <MenuItemActions key={item.id} item={toRow(item)} />
              ))}
              {!catalog.rows.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No catalog items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
