"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr, type Order } from "@pratham/shared";
import { api } from "@/lib/http";

const STATUS_LABEL: Record<string, string> = {
  placed: "Received",
  preparing: "Packing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

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
        <p className="student-kicker">Ahariva</p>
        <h1 className="student-title">Orders</h1>
        <div className="student-skeleton" style={{ width: "70%" }} />
        <div className="student-skeleton" style={{ height: 72 }} />
      </div>
    );
  }

  return (
    <div>
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Orders</h1>
      <p className="student-muted">Track meals · pay cash on delivery</p>
      {!orders.length && <p className="student-empty">No orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} className="student-card">
          <div className="student-row" style={{ justifyContent: "space-between" }}>
            <strong style={{ textTransform: "capitalize" }}>{o.meal_type}</strong>
            <span
              className={`student-badge ${
                o.status === "delivered"
                  ? "ok"
                  : o.status === "cancelled"
                    ? "muted"
                    : ""
              }`}
            >
              {STATUS_LABEL[String(o.status)] ||
                String(o.status).replaceAll("_", " ")}
            </span>
          </div>
          <div className="student-muted" style={{ marginBottom: 0 }}>
            {String(o.order_date).slice(0, 10)} · qty {o.quantity} ·{" "}
            {o.source === "fixed_plan" ? "Plan" : "Extra"}
          </div>
          <div style={{ fontWeight: 800, marginTop: 8, letterSpacing: "-0.02em" }}>
            {formatInr(Number(o.payable_amount))}
          </div>
        </div>
      ))}
    </div>
  );
}
