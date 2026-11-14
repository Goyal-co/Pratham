import { query } from "@pratham/db";
import { formatInr, getZonedParts } from "@pratham/shared";
import { OrderStatusActions } from "./OrderStatusActions";
import { GeneratePlansButton } from "./GeneratePlansButton";
import { OrdersFilters } from "./OrdersFilters";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const today = getZonedParts().dateStr;
  const params: unknown[] = [today];
  const clauses = ["o.order_date = $1"];
  if (sp.meal && sp.meal !== "all") {
    params.push(sp.meal);
    clauses.push(`o.meal_type = $${params.length}`);
  }
  if (sp.status && sp.status !== "all") {
    params.push(sp.status);
    clauses.push(`o.status = $${params.length}`);
  }

  const { rows: orders } = await query(
    `select o.*, u.full_name, u.phone
     from orders o
     join users u on u.id = o.student_id
     where ${clauses.join(" and ")}
     order by o.created_at desc`,
    params
  );

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 4 }}>Orders</h1>
          <p className="muted">Today ({today})</p>
        </div>
        <GeneratePlansButton />
      </div>
      <div style={{ marginTop: 12 }}>
        <OrdersFilters meal={sp.meal || "all"} status={sp.status || "all"} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Meal</th>
              <th>Qty</th>
              <th>COD</th>
              <th>Source</th>
              <th>Status</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <div>{o.full_name}</div>
                  <div className="muted">{o.phone}</div>
                </td>
                <td style={{ textTransform: "capitalize" }}>{o.meal_type}</td>
                <td>{o.quantity}</td>
                <td>{formatInr(Number(o.payable_amount))}</td>
                <td>
                  <span className="badge">{o.source}</span>
                </td>
                <td>{String(o.status).replaceAll("_", " ")}</td>
                <td>
                  <OrderStatusActions orderId={o.id} status={o.status} />
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="muted">
                  No orders match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
