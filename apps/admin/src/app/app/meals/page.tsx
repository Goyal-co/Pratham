"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  formatInr,
  getZonedParts,
  isMealOpen,
  type MealType,
  type MenuItem,
} from "@pratham/shared";
import { api } from "@/lib/http";
import { studentHref, useStudentBase } from "@/lib/student-paths";
import { studentCacheInvalidate } from "@/lib/student-cache";
import { addDaysYmd, weekdayShort } from "@/lib/student-ui";

type PlanRow = {
  meal_type: MealType;
  menu_item_name?: string | null;
};

type OrderRow = {
  id: string;
  meal_type: MealType;
  quantity: number;
  payable_amount: number;
  gross_amount?: number;
  status: string;
  order_date: string;
  item_name?: string | null;
  menu_item_name?: string | null;
};

type Cutoffs = Record<MealType, string>;

const STATUS_LABEL: Record<string, string> = {
  placed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function MyMealsPage() {
  const base = useStudentBase();
  const today = getZonedParts().dateStr;
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cancellations, setCancellations] = useState<
    { meal_type: MealType; cancel_date: string }[]
  >([]);
  const [dayMenu, setDayMenu] = useState<MenuItem[]>([]);
  const [cutoffs, setCutoffs] = useState<Cutoffs>(DEFAULT_CUTOFFS);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [data, settings] = await Promise.all([
      api<{
        plans: PlanRow[];
        orders: OrderRow[];
        cancellations: { meal_type: MealType; cancel_date: string }[];
      }>(`/api/app/meals?month=${month}`),
      api<{ settings: Record<string, string> }>("/api/settings").catch(
        () => ({ settings: {} as Record<string, string> })
      ),
    ]);
    setPlans(data.plans ?? []);
    setOrders(data.orders ?? []);
    setCancellations(data.cancellations ?? []);
    if (settings.settings) {
      setCutoffs({
        breakfast:
          settings.settings.breakfast_cutoff || DEFAULT_CUTOFFS.breakfast,
        lunch: settings.settings.lunch_cutoff || DEFAULT_CUTOFFS.lunch,
        dinner: settings.settings.dinner_cutoff || DEFAULT_CUTOFFS.dinner,
      });
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!selectedDate) {
      setDayMenu([]);
      return;
    }
    let cancelled = false;
    api<{ items: MenuItem[] }>(`/api/menu?date=${selectedDate}`)
      .then((data) => {
        if (!cancelled) setDayMenu(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setDayMenu([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const hasPlan = plans.length > 0;

  const calendarDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const cells: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    return cells;
  }, [month]);

  const planMeals = useMemo(
    () => new Set(plans.map((p) => p.meal_type)),
    [plans]
  );

  function dayStatus(ymd: string | null) {
    if (!ymd) return null;
    const skipped = cancellations.filter((c) => c.cancel_date === ymd);
    const scheduled = [...planMeals].filter(
      (m) => !skipped.some((s) => s.meal_type === m)
    );
    return { skipped: skipped.length, scheduled: scheduled.length };
  }

  function canEditDateMeal(date: string, meal: MealType) {
    if (date < today) return false;
    if (date > today) return true;
    return isMealOpen(meal, cutoffs);
  }

  async function skipMeal(meal: MealType, date: string) {
    const key = `skip:${date}:${meal}`;
    setBusyKey(key);
    try {
      await api("/api/plans/cancel-day", {
        method: "POST",
        json: { cancel_date: date, meal_types: [meal] },
      });
      setMsg(`Skipped ${MEAL_LABELS[meal]} on ${date}`);
      studentCacheInvalidate("home:");
      studentCacheInvalidate("plans:");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Skip failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function resumeMeal(meal: MealType, date: string) {
    const key = `resume:${date}:${meal}`;
    setBusyKey(key);
    try {
      await api("/api/plans/cancel-day", {
        method: "DELETE",
        json: { cancel_date: date, meal_types: [meal] },
      });
      setMsg(`${MEAL_LABELS[meal]} is back on for ${date}`);
      studentCacheInvalidate("home:");
      studentCacheInvalidate("plans:");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Resume failed");
    } finally {
      setBusyKey(null);
    }
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }

  const recentOrders = orders.slice(0, 8);

  if (loading) {
    return (
      <div>
        <h1 className="v2-page-title">My Meals</h1>
        <div className="student-skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="v2-page-title">My Meals</h1>
      <p className="v2-page-sub">
        Tap a date to skip or resume plan meals for that day.
      </p>
      {msg && <div className="student-banner info">{msg}</div>}

      {!hasPlan ? (
        <div className="v2-empty">
          <div className="v2-empty-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect
                x="4"
                y="5"
                width="16"
                height="15"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M8 3.5v3.5M16 3.5v3.5M4 10h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2>No meal plan yet</h2>
          <p>
            Add breakfast, lunch, or dinner to your plan first — then you can
            skip or keep them on any date here.
          </p>
          <Link href={studentHref(base, "/plans")} className="student-btn">
            Build meal plan
          </Link>
        </div>
      ) : (
        <>
          <div className="v2-promo" style={{ cursor: "default" }}>
            <span className="v2-promo-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect
                  x="4"
                  y="5"
                  width="16"
                  height="15"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 3.5v3.5M16 3.5v3.5M4 10h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div>
              <strong>
                {plans.map((p) => MEAL_LABELS[p.meal_type]).join(" + ")}
              </strong>
              <p>Active meal plan</p>
            </div>
            <Link href={studentHref(base, "/plans")} className="v2-link">
              Manage
            </Link>
          </div>

          <div className="student-panel">
            <div className="student-panel-head">
              <button
                type="button"
                className="v2-link"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <h2 style={{ fontSize: "0.95rem" }}>
                {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </h2>
              <button
                type="button"
                className="v2-link"
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
            <div className="student-panel-body">
              <div className="student-cal-grid-head">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={`${d}-${i}`}>{d}</span>
                ))}
              </div>
              <div className="student-cal-grid">
                {calendarDays.map((ymd, i) => {
                  if (!ymd) {
                    return (
                      <div key={`e-${i}`} className="student-cal-day empty" />
                    );
                  }
                  const st = dayStatus(ymd)!;
                  const active = selectedDate === ymd;
                  const isToday = ymd === today;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className={`student-cal-day${st.scheduled ? " has" : ""}${isToday ? " today" : ""}${active ? " active" : ""}`}
                      onClick={() => setSelectedDate(ymd)}
                    >
                      <strong>{Number(ymd.slice(8))}</strong>
                      {st.skipped > 0 ? <span>·</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedDate && (
            <section className="student-panel">
              <div className="student-panel-head">
                <h2>
                  {weekdayShort(selectedDate)} · {selectedDate}
                </h2>
              </div>
              <div className="student-panel-body">
                {(["breakfast", "lunch", "dinner"] as MealType[])
                  .filter((m) => planMeals.has(m))
                  .map((meal) => {
                    const skipped = cancellations.some(
                      (c) =>
                        c.cancel_date === selectedDate && c.meal_type === meal
                    );
                    const published = dayMenu.filter(
                      (i) => i.meal_type === meal
                    );
                    const name = published.length
                      ? published.map((i) => i.name).join(" · ")
                      : "Menu coming soon";
                    const editable = canEditDateMeal(selectedDate, meal);
                    const key = `${skipped ? "resume" : "skip"}:${selectedDate}:${meal}`;
                    return (
                      <div key={meal} className="v2-schedule-card">
                        <div className="top">
                          <h3>{MEAL_LABELS[meal]}</h3>
                          <span
                            className={`student-badge ${skipped ? "muted" : "ok"}`}
                          >
                            {skipped ? "Skipped" : "Scheduled"}
                          </span>
                        </div>
                        <p className="dish">{name}</p>
                        {published.map((i) => (
                          <p
                            key={i.id}
                            className="meta"
                            style={{ marginTop: 2 }}
                          >
                            {formatInr(Number(i.price))}
                            {i.description ? ` · ${i.description}` : ""}
                          </p>
                        ))}
                        {editable ? (
                          <button
                            type="button"
                            className="v2-link"
                            style={{ marginTop: 8 }}
                            disabled={!!busyKey}
                            onClick={() =>
                              skipped
                                ? resumeMeal(meal, selectedDate)
                                : skipMeal(meal, selectedDate)
                            }
                          >
                            {busyKey === key
                              ? "Saving…"
                              : skipped
                                ? "Resume this meal"
                                : "Skip this meal"}
                          </button>
                        ) : (
                          <p className="meta" style={{ marginTop: 8 }}>
                            {selectedDate < today
                              ? "Past date"
                              : "Order window closed"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                <Link
                  href={studentHref(
                    base,
                    `/plans?skip=${selectedDate || addDaysYmd(today, 1)}`
                  )}
                  className="student-btn secondary"
                  style={{ marginTop: 8 }}
                >
                  Skip multiple meals
                </Link>
              </div>
            </section>
          )}
        </>
      )}

      <div className="v2-section-head">
        <h2>Your Orders</h2>
        <Link href={studentHref(base, "/orders")} className="v2-link">
          View all
        </Link>
      </div>

      {!recentOrders.length && (
        <p className="student-empty">
          No orders yet — browse the menu to start.
        </p>
      )}
      {recentOrders.map((o) => (
        <div key={o.id} className="v2-order-row">
          <span className="v2-order-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 7h12l1 3H5l1-3zM6 10h12l-1 10H7L6 10z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="copy">
            <strong>
              {MEAL_LABELS[o.meal_type]} · {String(o.order_date).slice(0, 10)}
            </strong>
            <span>
              {o.item_name || o.menu_item_name || "Meal"} · {o.quantity} plate
              {o.quantity > 1 ? "s" : ""}
            </span>
          </div>
          <div className="right">
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
            <span className="amt">
              {formatInr(Number(o.gross_amount ?? o.payable_amount))}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
