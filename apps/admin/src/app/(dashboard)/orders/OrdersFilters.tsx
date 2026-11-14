"use client";

import { useRouter } from "next/navigation";

export function OrdersFilters({
  meal,
  status,
}: {
  meal: string;
  status: string;
}) {
  const router = useRouter();

  function update(nextMeal: string, nextStatus: string) {
    const qs = new URLSearchParams();
    if (nextMeal !== "all") qs.set("meal", nextMeal);
    if (nextStatus !== "all") qs.set("status", nextStatus);
    const q = qs.toString();
    router.push(q ? `/orders?${q}` : "/orders");
  }

  return (
    <div className="row">
      <label className="field" style={{ marginBottom: 0 }}>
        Meal
        <select
          value={meal}
          onChange={(e) => update(e.target.value, status)}
        >
          <option value="all">All</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
        </select>
      </label>
      <label className="field" style={{ marginBottom: 0 }}>
        Status
        <select
          value={status}
          onChange={(e) => update(meal, e.target.value)}
        >
          <option value="all">All</option>
          <option value="placed">Placed</option>
          <option value="preparing">Preparing</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
    </div>
  );
}
