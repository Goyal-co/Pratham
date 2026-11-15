"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInr, getZonedParts, type MealType } from "@pratham/shared";
import { api } from "@/lib/http";
import { StudentActions } from "../StudentActions";

type Student = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  hostel: string | null;
  room: string | null;
  referral_code: string;
};

type Account = {
  credit_limit: number;
  wallet_credit: number;
  debt: number;
  credit_available: number;
};

type DayCell = {
  date: string;
  day: number;
  orders: number;
  delivered: number;
  open: number;
  cancelled: number;
};

type OrderRow = {
  id: string;
  meal_type: MealType;
  quantity: number;
  payable_amount: number;
  wallet_applied: number;
  status: string;
  source: string;
  order_date: string;
  item_name?: string | null;
  created_at: string;
};

type LedgerRow = {
  id: string;
  entry_type: string;
  amount: number;
  note: string | null;
  created_at: string;
  order_id: string | null;
};

type Counts = {
  orders_total: number;
  delivered: number;
  cancelled: number;
  open: number;
  plan_orders: number;
  adhoc_orders: number;
  charged_total: number;
};

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AdminStudentHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const today = getZonedParts().dateStr;
  const [student, setStudent] = useState<Student | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [meal, setMeal] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [account, setAccount] = useState<Account | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [calendar, setCalendar] = useState<DayCell[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ month });
    if (meal !== "all") qs.set("meal", meal);
    if (status !== "all") qs.set("status", status);
    if (source !== "all") qs.set("source", source);
    if (selectedDate) qs.set("date", selectedDate);
    const data = await api<{
      student: Student;
      account: Account;
      counts: Counts;
      calendar: DayCell[];
      orders: OrderRow[];
      ledger: LedgerRow[];
    }>(`/api/students/${id}/history?${qs}`);
    setStudent(data.student);
    setAccount(data.account);
    setCounts(data.counts);
    setCalendar(data.calendar);
    setOrders(data.orders);
    setLedger(data.ledger);
  }, [id, month, meal, status, source, selectedDate]);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    load()
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [load]);

  const weekdayOffset = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return (dow + 6) % 7;
  }, [month]);

  return (
    <div>
      <p className="muted" style={{ marginBottom: 8 }}>
        <Link href="/students">← Students</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{student?.full_name || "Student"}</h1>
      {student && (
        <p className="muted">
          {student.email} · {student.phone} · {[student.hostel, student.room]
            .filter(Boolean)
            .join(" ")}{" "}
          · code {student.referral_code}
        </p>
      )}
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      {account && (
        <div className="grid-stats">
          <div className="card stat">
            <h3>Wallet</h3>
            <p>{formatInr(account.wallet_credit)}</p>
          </div>
          <div className="card stat">
            <h3>Available</h3>
            <p>{formatInr(account.credit_available)}</p>
          </div>
          <div className="card stat">
            <h3>Credit limit</h3>
            <p>{formatInr(account.credit_limit)}</p>
          </div>
          <div className="card stat">
            <h3>Debt</h3>
            <p>{formatInr(account.debt)}</p>
          </div>
        </div>
      )}

      {account && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Wallet is the only balance (can be negative). Credit limit = max
            borrow. Collect cash → wallet increases.
          </p>
          <StudentActions
            studentId={id}
            creditLimit={account.credit_limit}
            wallet={account.wallet_credit}
          />
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ marginTop: 0 }}>History · {month}</h2>
          <div className="row">
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setMonth((m) => shiftMonth(m, -1));
              }}
            >
              ‹
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setMonth((m) => shiftMonth(m, 1));
              }}
            >
              ›
            </button>
          </div>
        </div>

        {counts && (
          <p className="muted">
            Orders {counts.orders_total} · Delivered {counts.delivered} · Open{" "}
            {counts.open} · Cancelled {counts.cancelled} · Plan{" "}
            {counts.plan_orders} · Extra {counts.adhoc_orders} · Charged{" "}
            {formatInr(counts.charged_total)}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            marginBottom: 12,
          }}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="muted"
              style={{ textAlign: "center", fontSize: 11, fontWeight: 700 }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: weekdayOffset }).map((_, i) => (
            <div key={`p-${i}`} />
          ))}
          {calendar.map((cell) => (
            <button
              key={cell.date}
              type="button"
              className="btn secondary"
              style={{
                padding: 6,
                minHeight: 44,
                background:
                  selectedDate === cell.date
                    ? "var(--orange)"
                    : cell.orders
                      ? "var(--orange-soft)"
                      : "#fff",
                color: selectedDate === cell.date ? "#fff" : undefined,
              }}
              onClick={() =>
                setSelectedDate((d) => (d === cell.date ? null : cell.date))
              }
            >
              <div style={{ fontWeight: 700 }}>{cell.day}</div>
              {cell.orders ? (
                <div style={{ fontSize: 10 }}>{cell.orders}</div>
              ) : null}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <label className="field">
            Meal
            <select value={meal} onChange={(e) => setMeal(e.target.value)}>
              <option value="all">All</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="placed">Received</option>
              <option value="preparing">Packing</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="field">
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All</option>
              <option value="fixed_plan">Plan</option>
              <option value="adhoc">Extra</option>
            </select>
          </label>
        </div>

        {loading && <p className="muted">Loading…</p>}

        <h3>Orders</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
                <th>Item</th>
                <th>COD</th>
                <th>Source</th>
                <th>Status</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_date}</td>
                  <td style={{ textTransform: "capitalize" }}>{o.meal_type}</td>
                  <td>
                    {o.item_name || "—"} × {o.quantity}
                  </td>
                  <td>{formatInr(Number(o.payable_amount))}</td>
                  <td>{o.source === "fixed_plan" ? "Plan" : "Extra"}</td>
                  <td>{o.status.replaceAll("_", " ")}</td>
                  <td className="muted">{o.id.slice(0, 8)}</td>
                </tr>
              ))}
              {!orders.length && !loading && (
                <tr>
                  <td colSpan={7} className="muted">
                    No orders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h3>Transactions</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Note</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString("en-IN")}</td>
                  <td>{l.entry_type}</td>
                  <td>{formatInr(Number(l.amount))}</td>
                  <td>{l.note || "—"}</td>
                  <td className="muted">
                    {l.order_id ? l.order_id.slice(0, 8) : "—"}
                  </td>
                </tr>
              ))}
              {!ledger.length && !loading && (
                <tr>
                  <td colSpan={5} className="muted">
                    No ledger entries
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
