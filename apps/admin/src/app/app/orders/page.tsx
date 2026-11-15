"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr, type Order } from "@pratham/shared";
import { api } from "@/lib/http";

export default function StudentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api<{ orders: Order[] }>("/api/orders");
    setOrders(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <div>
        <h1 className="student-title">Orders</h1>
        <p className="student-muted">Loading orders…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="student-title">Orders</h1>
      <p className="student-muted">Recent meals · COD</p>
      {!orders.length && <p className="student-muted">No orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} className="student-card">
          <div className="student-row">
            <strong style={{ textTransform: "capitalize" }}>{o.meal_type}</strong>
            <span className="student-badge">{String(o.status).replaceAll("_", " ")}</span>
          </div>
          <div className="student-muted">
            {String(o.order_date).slice(0, 10)} · qty {o.quantity} ·{" "}
            {o.source === "fixed_plan" ? "Plan" : "Ad-hoc"}
          </div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>
            {formatInr(Number(o.payable_amount))}
          </div>
        </div>
      ))}
    </div>
  );
}
