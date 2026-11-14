import Link from "next/link";
import { query } from "@pratham/db";
import {
  formatCountdown,
  formatInr,
  getOpenMeals,
  getZonedParts,
  minutesUntilCutoff,
  type MealType,
} from "@pratham/shared";

export default async function DashboardPage() {
  const today = getZonedParts().dateStr;
  const { rows: orders } = await query(
    `select meal_type, quantity, payable_amount from orders
     where order_date = $1 and status <> 'cancelled'`,
    [today]
  );
  const { rows: studentRows } = await query(
    `select count(*)::int as c from users where role = 'student'`
  );
  const { rows: refRows } = await query(
    `select count(*)::int as c from referrals where status = 'pending'`
  );
  const { rows: blockedRows } = await query(
    `select count(*)::int as c from student_accounts
     where outstanding_balance >= credit_limit`
  );
  const { rows: settingsRows } = await query(
    `select breakfast_cutoff, lunch_cutoff, dinner_cutoff, timezone
     from app_settings where id = 1`
  );
  const settings = settingsRows[0] || {
    breakfast_cutoff: "06:00",
    lunch_cutoff: "11:00",
    dinner_cutoff: "17:00",
    timezone: "Asia/Kolkata",
  };
  const cutoffs = {
    breakfast: settings.breakfast_cutoff,
    lunch: settings.lunch_cutoff,
    dinner: settings.dinner_cutoff,
  } as Record<MealType, string>;
  const openMeals = getOpenMeals(cutoffs, new Date(), settings.timezone);

  const byMeal = { breakfast: 0, lunch: 0, dinner: 0 };
  let kitchenUnits = 0;
  let revenue = 0;
  for (const o of orders) {
    byMeal[o.meal_type as keyof typeof byMeal] += Number(o.quantity);
    kitchenUnits += Number(o.quantity);
    revenue += Number(o.payable_amount);
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Today&apos;s kitchen</h1>
      <p className="muted">{today} · Asia/Kolkata · COD only</p>

      <div className="grid-stats">
        <Link href="/kitchen" className="card stat">
          <h3>Kitchen units</h3>
          <p>{kitchenUnits}</p>
        </Link>
        <Link href="/orders" className="card stat">
          <h3>COD outstanding today</h3>
          <p>{formatInr(revenue)}</p>
        </Link>
        <Link href="/students" className="card stat">
          <h3>Students</h3>
          <p>{studentRows[0]?.c ?? 0}</p>
        </Link>
        <Link href="/students" className="card stat">
          <h3>Credit blocked</h3>
          <p>{blockedRows[0]?.c ?? 0}</p>
        </Link>
      </div>

      <div className="grid-stats">
        <div className="card stat">
          <h3>Pending referrals</h3>
          <p>{refRows[0]?.c ?? 0}</p>
        </div>
        <div className="card stat" style={{ gridColumn: "span 3" }}>
          <h3>Open cutoffs now</h3>
          <p style={{ fontSize: "1rem", fontWeight: 700 }}>
            {openMeals.length
              ? openMeals
                  .map(
                    (m) =>
                      `${m} (${formatCountdown(minutesUntilCutoff(m, cutoffs))})`
                  )
                  .join(" · ")
              : "All meals closed for today"}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ marginTop: 0 }}>Meals by slot</h2>
          <Link className="btn secondary" href="/kitchen">
            Open kitchen
          </Link>
        </div>
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Meal</th>
              <th>Units</th>
              <th>Cutoff</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byMeal).map(([meal, qty]) => (
              <tr key={meal}>
                <td style={{ textTransform: "capitalize" }}>{meal}</td>
                <td>{qty}</td>
                <td>{cutoffs[meal as MealType]}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
