import { query } from "@pratham/db";
import { formatInr, getZonedParts } from "@pratham/shared";
import { KitchenAdvance } from "./KitchenAdvance";
import { MarkMealDelivered } from "./MarkMealDelivered";

const STAGES = [
  {
    key: "placed",
    title: "New",
    hint: "Start packing",
  },
  {
    key: "preparing",
    title: "Packing",
    hint: "In kitchen",
  },
  {
    key: "out_for_delivery",
    title: "Out for delivery",
    hint: "On the way",
  },
  {
    key: "delivered",
    title: "Delivered",
    hint: "Done",
  },
] as const;

const MEALS = ["breakfast", "lunch", "dinner"] as const;

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

  const openByMeal = Object.fromEntries(
    MEALS.map((meal) => [
      meal,
      rows.filter(
        (o) =>
          o.meal_type === meal &&
          ["placed", "preparing", "out_for_delivery"].includes(o.status)
      ).length,
    ])
  ) as Record<(typeof MEALS)[number], number>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Kitchen</h1>
      <p className="muted">{date} · mark a whole meal delivered when the round is done</p>

      <form className="row" style={{ marginBottom: 12 }}>
        <label className="field">
          Date
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button className="btn secondary" type="submit">
          Load
        </button>
      </form>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Deliver whole meal</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Marks the meal round done. Wallet was already charged when ordered.
        </p>
        <div className="row">
          {MEALS.map((meal) => (
            <MarkMealDelivered
              key={meal}
              date={date}
              meal={meal}
              count={openByMeal[meal]}
            />
          ))}
        </div>
      </div>

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
                  {stage.key !== "delivered" && (
                    <div style={{ marginTop: 10 }}>
                      <KitchenAdvance orderId={o.id} status={o.status} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
