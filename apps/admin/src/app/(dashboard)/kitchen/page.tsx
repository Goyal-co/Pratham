import { query } from "@pratham/db";
import { formatInr, getZonedParts } from "@pratham/shared";
import { KitchenAdvance } from "./KitchenAdvance";

const STAGES = [
  {
    key: "placed",
    title: "New orders",
    hint: "Accept into packing",
  },
  {
    key: "preparing",
    title: "Packing",
    hint: "Kitchen packing tiffins",
  },
  {
    key: "out_for_delivery",
    title: "Out for delivery",
    hint: "On the way to hostels",
  },
  {
    key: "delivered",
    title: "Delivered",
    hint: "Done for today",
  },
] as const;

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const { dateStr: today } = getZonedParts();
  const date = sp.date || today;

  const { rows } = await query(
    `select o.*, u.full_name, u.phone, mi.name as item_name
     from orders o
     join users u on u.id = o.student_id
     join menu_items mi on mi.id = o.menu_item_id
     where o.order_date = $1::date
       and o.status in ('placed','preparing','out_for_delivery','delivered')
     order by o.meal_type, o.created_at`,
    [date]
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Kitchen board</h1>
      <p className="muted">
        New → Packing → Out for delivery → Delivered · {date}
      </p>
      <form className="row" style={{ marginBottom: 16 }}>
        <label className="field">
          Order date
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button className="btn" type="submit">
          Load
        </button>
      </form>

      <div className="kitchen-board">
        {STAGES.map((stage) => {
          const list = rows.filter((o) => o.status === stage.key);
          return (
            <div className="kitchen-col" data-stage={stage.key} key={stage.key}>
              <h2>
                {stage.title}{" "}
                <span className="muted" style={{ fontWeight: 500 }}>
                  ({list.length})
                </span>
              </h2>
              <p className="muted">{stage.hint}</p>
              {!list.length && <p className="muted">Empty</p>}
              {list.map((o) => (
                <div key={o.id} className="kitchen-ticket">
                  <div style={{ fontWeight: 750 }}>
                    {o.full_name} ·{" "}
                    <span style={{ textTransform: "capitalize" }}>{o.meal_type}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {o.item_name} × {o.quantity} · {formatInr(Number(o.payable_amount))}
                    <br />
                    {o.phone}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <KitchenAdvance orderId={o.id} status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
