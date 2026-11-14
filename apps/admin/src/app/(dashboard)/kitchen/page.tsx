import Link from "next/link";
import { query } from "@pratham/db";
import { getZonedParts } from "@pratham/shared";
import { KitchenAdvance } from "./KitchenAdvance";

export default async function KitchenPage() {
  const today = getZonedParts().dateStr;
  const { rows: orders } = await query(
    `select o.*, u.full_name, u.phone, u.hostel, u.room
     from orders o
     join users u on u.id = o.student_id
     where o.order_date = $1 and o.status <> 'cancelled'
     order by o.meal_type, o.created_at`,
    [today]
  );

  const byMeal = { breakfast: 0, lunch: 0, dinner: 0 };
  const byStatus: Record<string, number> = {
    placed: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0,
  };
  for (const o of orders) {
    byMeal[o.meal_type as keyof typeof byMeal] += Number(o.quantity);
    byStatus[o.status] = (byStatus[o.status] || 0) + Number(o.quantity);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 4 }}>Kitchen</h1>
          <p className="muted">Prep board for {today}</p>
        </div>
        <Link className="btn secondary" href="/orders">
          All orders
        </Link>
      </div>

      <div className="grid-stats" style={{ marginTop: 16 }}>
        {Object.entries(byMeal).map(([meal, qty]) => (
          <div className="card stat" key={meal}>
            <h3 style={{ textTransform: "capitalize" }}>{meal}</h3>
            <p>{qty}</p>
          </div>
        ))}
        <div className="card stat">
          <h3>In kitchen</h3>
          <p>
            {(byStatus.placed || 0) +
              (byStatus.preparing || 0) +
              (byStatus.out_for_delivery || 0)}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Status units</h2>
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {["placed", "preparing", "out_for_delivery", "delivered"].map((s) => (
              <tr key={s}>
                <td>{s.replaceAll("_", " ")}</td>
                <td>{byStatus[s] || 0}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Prep list</h2>
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Meal</th>
              <th>Qty</th>
              <th>Source</th>
              <th>Notes</th>
              <th>Status</th>
              <th>Advance</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <div>{o.full_name}</div>
                  <div className="muted">
                    {o.hostel} {o.room} · {o.phone}
                  </div>
                </td>
                <td style={{ textTransform: "capitalize" }}>{o.meal_type}</td>
                <td>{o.quantity}</td>
                <td>
                  <span className="badge">{o.source}</span>
                </td>
                <td>{o.notes || "—"}</td>
                <td>{String(o.status).replaceAll("_", " ")}</td>
                <td>
                  <KitchenAdvance orderId={o.id} status={o.status} />
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="muted">
                  No active kitchen orders today.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
