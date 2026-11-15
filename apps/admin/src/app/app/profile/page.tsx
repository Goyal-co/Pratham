"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInr, getZonedParts, MEAL_LABELS, type MealType } from "@pratham/shared";
import { api } from "@/lib/http";
import { studentHref, useStudentBase } from "@/lib/student-paths";

type User = {
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
  cancelled: number;
  open: number;
  payable_sum: number;
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
  meal_type?: string | null;
  order_date?: string | null;
};

type Counts = {
  orders_total: number;
  delivered: number;
  cancelled: number;
  open: number;
  plan_orders: number;
  adhoc_orders: number;
  held_in_month: number;
  delivered_cod: number;
};

const STATUS_LABEL: Record<string, string> = {
  placed: "Received",
  preparing: "Packing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const base = useStudentBase();
  const today = getZonedParts().dateStr;
  const [user, setUser] = useState<User | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [meal, setMeal] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [entryType, setEntryType] = useState("all");
  const [account, setAccount] = useState<Account | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [calendar, setCalendar] = useState<DayCell[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "ledger">("orders");

  const loadHistory = useCallback(async () => {
    const qs = new URLSearchParams({ month });
    if (meal !== "all") qs.set("meal", meal);
    if (status !== "all") qs.set("status", status);
    if (source !== "all") qs.set("source", source);
    if (entryType !== "all") qs.set("entry_type", entryType);
    if (selectedDate) qs.set("date", selectedDate);
    const data = await api<{
      account: Account;
      counts: Counts;
      calendar: DayCell[];
      orders: OrderRow[];
      ledger: LedgerRow[];
    }>(`/api/app/history?${qs}`);
    setAccount(data.account);
    setCounts(data.counts);
    setCalendar(data.calendar);
    setOrders(data.orders);
    setLedger(data.ledger);
  }, [month, meal, status, source, entryType, selectedDate]);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadHistory()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [loadHistory]);

  const weekdayOffset = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    // Monday-first grid: JS Sunday=0
    const dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return (dow + 6) % 7;
  }, [month]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push(studentHref(base, "/login"));
    router.refresh();
  }

  if (!user) {
    return (
      <div>
        <p className="student-kicker">Ahariva</p>
        <h1 className="student-title">Profile</h1>
        <div className="student-skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div>
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Profile</h1>
      <p className="student-muted">Account, orders & transaction history</p>

      <div className="student-panel">
        <div className="student-panel-body">
          <div className="student-dish-name" style={{ fontSize: "1.2rem" }}>
            {user.full_name}
          </div>
          <div className="student-dish-desc">{user.email}</div>
          <div className="student-dish-desc">{user.phone}</div>
          <div className="student-dish-desc">
            {[user.hostel, user.room].filter(Boolean).join(" · ") || "—"}
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="student-badge">Referral · {user.referral_code}</span>
          </div>
        </div>
      </div>

      {account && (
        <section className="student-panel">
          <div className="student-panel-head">
            <h2>Account</h2>
          </div>
          <div className="student-panel-body">
            <div className="student-stat-grid">
              <div className="student-stat">
                <span>Wallet</span>
                <strong>{formatInr(account.wallet_credit)}</strong>
              </div>
              <div className="student-stat">
                <span>Available</span>
                <strong>{formatInr(account.credit_available)}</strong>
              </div>
              <div className="student-stat">
                <span>Credit limit</span>
                <strong>{formatInr(account.credit_limit)}</strong>
              </div>
              <div className="student-stat">
                <span>Debt</span>
                <strong>{formatInr(account.debt)}</strong>
              </div>
            </div>
            <p className="student-panel-note" style={{ marginTop: 12 }}>
              <strong>Wallet</strong> — every order, payment, and reward moves
              here (can go negative). <strong>Credit limit</strong> — max you can
              borrow. <strong>Available</strong> = wallet + limit.{" "}
              <strong>Debt</strong> — amount owed when wallet is negative.
            </p>
          </div>
        </section>
      )}

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>History</h2>
          <div className="student-row" style={{ gap: 6 }}>
            <button
              type="button"
              className="student-btn secondary compact"
              style={{ width: "auto", minWidth: 40 }}
              onClick={() => {
                setSelectedDate(null);
                setMonth((m) => shiftMonth(m, -1));
              }}
            >
              ‹
            </button>
            <span className="student-badge muted">{month}</span>
            <button
              type="button"
              className="student-btn secondary compact"
              style={{ width: "auto", minWidth: 40 }}
              onClick={() => {
                setSelectedDate(null);
                setMonth((m) => shiftMonth(m, 1));
              }}
            >
              ›
            </button>
          </div>
        </div>
        <div className="student-panel-body">
          {counts && (
            <div className="student-stat-grid" style={{ marginBottom: 12 }}>
              <div className="student-stat">
                <span>Orders</span>
                <strong>{counts.orders_total}</strong>
              </div>
              <div className="student-stat">
                <span>Delivered</span>
                <strong>{counts.delivered}</strong>
              </div>
              <div className="student-stat">
                <span>Open</span>
                <strong>{counts.open}</strong>
              </div>
              <div className="student-stat">
                <span>Cancelled</span>
                <strong>{counts.cancelled}</strong>
              </div>
            </div>
          )}

          <div className="student-cal-grid-head">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="student-cal-grid">
            {Array.from({ length: weekdayOffset }).map((_, i) => (
              <div key={`pad-${i}`} className="student-cal-day empty" />
            ))}
            {calendar.map((cell) => {
              const active = selectedDate === cell.date;
              const has = cell.orders > 0;
              return (
                <button
                  key={cell.date}
                  type="button"
                  className={`student-cal-day${has ? " has" : ""}${active ? " active" : ""}${cell.date === today ? " today" : ""}`}
                  onClick={() =>
                    setSelectedDate((d) => (d === cell.date ? null : cell.date))
                  }
                >
                  <strong>{cell.day}</strong>
                  {has ? <span>{cell.orders}</span> : null}
                </button>
              );
            })}
          </div>
          {selectedDate && (
            <p className="student-panel-note" style={{ marginTop: 10 }}>
              Showing {selectedDate}. Tap again to clear day filter.
            </p>
          )}

          <div className="student-filter-row">
            <label className="student-field" style={{ marginBottom: 0 }}>
              Meal
              <select value={meal} onChange={(e) => setMeal(e.target.value)}>
                <option value="all">All</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </label>
            <label className="student-field" style={{ marginBottom: 0 }}>
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
            <label className="student-field" style={{ marginBottom: 0 }}>
              Source
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="all">All</option>
                <option value="fixed_plan">Plan</option>
                <option value="adhoc">Extra</option>
              </select>
            </label>
            {tab === "ledger" && (
              <label className="student-field" style={{ marginBottom: 0 }}>
                Txn type
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="order_charge">Order charge</option>
                  <option value="cod_collection">Cash paid</option>
                  <option value="referral_credit">Referral</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </label>
            )}
          </div>

          <div className="student-seg">
            <button
              type="button"
              className={tab === "orders" ? "active" : undefined}
              onClick={() => setTab("orders")}
            >
              Orders
            </button>
            <button
              type="button"
              className={tab === "ledger" ? "active" : undefined}
              onClick={() => setTab("ledger")}
            >
              Transactions
            </button>
          </div>

          {loading && <div className="student-skeleton" style={{ height: 48 }} />}

          {!loading && tab === "orders" && (
            <>
              {!orders.length && (
                <p className="student-empty">No orders for this filter.</p>
              )}
              {orders.map((o) => (
                <div key={o.id} className="student-card">
                  <div
                    className="student-row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <strong>
                      {MEAL_LABELS[o.meal_type]} · {o.order_date}
                    </strong>
                    <span
                      className={`student-badge ${
                        o.status === "delivered"
                          ? "ok"
                          : o.status === "cancelled"
                            ? "muted"
                            : ""
                      }`}
                    >
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  <div className="student-muted" style={{ marginBottom: 0 }}>
                    {o.item_name || "Dish"} × {o.quantity} ·{" "}
                    {o.source === "fixed_plan" ? "Plan" : "Extra"}
                    {Number(o.wallet_applied) > 0
                      ? ` · wallet ${formatInr(Number(o.wallet_applied))}`
                      : ""}
                  </div>
                  <div style={{ fontWeight: 800, marginTop: 8 }}>
                    COD {formatInr(Number(o.payable_amount))}
                  </div>
                  <div className="student-muted" style={{ marginBottom: 0, fontSize: 11 }}>
                    ID {o.id.slice(0, 8)} ·{" "}
                    {new Date(o.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && tab === "ledger" && (
            <>
              {!ledger.length && (
                <p className="student-empty">No transactions this month.</p>
              )}
              {ledger.map((l) => (
                <div key={l.id} className="student-card">
                  <div
                    className="student-row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="student-badge">{l.entry_type}</span>
                    <strong>{formatInr(Number(l.amount))}</strong>
                  </div>
                  <div className="student-muted" style={{ marginBottom: 0, marginTop: 6 }}>
                    {l.note || "—"}
                    {l.order_date
                      ? ` · ${l.meal_type || "order"} ${l.order_date}`
                      : ""}
                  </div>
                  <div className="student-muted" style={{ marginBottom: 0, fontSize: 11 }}>
                    {new Date(l.created_at).toLocaleString("en-IN")}
                    {l.order_id ? ` · order ${l.order_id.slice(0, 8)}` : ""}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <div className="student-card">
        <Link
          href={studentHref(base, "/wallet")}
          style={{ fontWeight: 750, color: "inherit", display: "block" }}
        >
          Wallet details →
        </Link>
      </div>
      <div className="student-card">
        <Link
          href={studentHref(base, "/notifications")}
          style={{ fontWeight: 750, color: "inherit", display: "block" }}
        >
          Notifications →
        </Link>
      </div>

      <button className="student-btn secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
