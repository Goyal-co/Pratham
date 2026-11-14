import { query } from "@pratham/db";
import { formatInr, getZonedParts } from "@pratham/shared";
import { MenuForm } from "./MenuForm";
import { PublishMenuButton } from "./PublishMenuButton";
import { getMenuForDate } from "@/lib/menu";

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export default async function MenuPage() {
  const { dateStr: today } = getZonedParts();
  const tomorrow = addDays(today, 1);

  const [todayItems, tomorrowItems, catalog, pubs] = await Promise.all([
    getMenuForDate(today),
    getMenuForDate(tomorrow),
    query(
      `select * from menu_items where menu_date is null order by meal_type, name`
    ),
    query(
      `select * from menu_day_pubs where menu_date in ($1::date, $2::date)`,
      [today, tomorrow]
    ),
  ]);

  const pubMap = Object.fromEntries(
    pubs.rows.map((p) => {
      const raw = p.menu_date;
      const key =
        typeof raw === "string"
          ? raw.slice(0, 10)
          : raw instanceof Date
            ? new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
              }).format(raw)
            : String(raw).slice(0, 10);
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
    items: typeof todayItems;
  }) {
    const pub = pubMap[date];
    const datedOnly = items.filter(
      (i) => i.menu_date && String(i.menu_date).slice(0, 10) === date
    );
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
              {datedOnly.length
                ? `${datedOnly.length} day-specific dish(es); other meals use catalog.`
                : "Using catalog defaults — add day-specific dishes below."}
              {pub
                ? ` · Published${pub.notify_sent_at ? " & notified" : ""}`
                : " · Not published yet"}
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
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ textTransform: "capitalize" }}>{item.meal_type}</td>
                  <td>
                    <div>{item.name}</div>
                    <div className="muted">{item.description}</div>
                  </td>
                  <td>{formatInr(Number(item.price))}</td>
                  <td>
                    {item.menu_date ? (
                      <span className="badge">Day menu</span>
                    ) : (
                      <span className="muted">Catalog</span>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No items yet.
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
        Set tomorrow&apos;s dishes, then <strong>Publish &amp; notify</strong> so
        students get a push. Closing / opening reminders run automatically via cron.
      </p>

      <DayTable title="Tomorrow" date={tomorrow} items={tomorrowItems} />
      <DayTable title="Today" date={today} items={todayItems} />

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add item</h2>
        <p className="muted">
          Pick tomorrow&apos;s date to schedule next-day menu, or leave date empty for
          catalog defaults.
        </p>
        <MenuForm defaultDate={tomorrow} />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Catalog defaults</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Name</th>
                <th>Price</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {catalog.rows.map((item) => (
                <tr key={item.id}>
                  <td style={{ textTransform: "capitalize" }}>{item.meal_type}</td>
                  <td>
                    <div>{item.name}</div>
                    <div className="muted">{item.description}</div>
                  </td>
                  <td>{formatInr(Number(item.price))}</td>
                  <td>{item.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
