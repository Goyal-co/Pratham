"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  formatCountdown,
  formatInr,
  getZonedParts,
  isMealOpen,
  minutesUntilCutoff,
  type MealType,
  type MenuItem,
} from "@pratham/shared";
import { api } from "@/lib/http";

type Cutoffs = Record<MealType, string>;

function addDaysYmd(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function weekdayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function StudentHomePage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tomorrowItems, setTomorrowItems] = useState<MenuItem[]>([]);
  const [cutoffs, setCutoffs] = useState<Cutoffs>(DEFAULT_CUTOFFS);
  const [account, setAccount] = useState({
    credit_limit: 0,
    wallet_credit: 0,
    debt: 0,
    credit_available: 0,
  });
  const [plans, setPlans] = useState<
    { meal_type: MealType; menu_item_id?: string | null; menu_item_name?: string | null }[]
  >([]);
  const [cancellations, setCancellations] = useState<
    { meal_type: MealType; cancel_date: string }[]
  >([]);
  const [calendarMenu, setCalendarMenu] = useState<MenuItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("there");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [skipMeals, setSkipMeals] = useState<Record<MealType, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [skipBusy, setSkipBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{
      todayItems: MenuItem[];
      tomorrowItems: MenuItem[];
      settings: Record<string, string | number>;
      account: {
        credit_limit: number;
        wallet_credit: number;
        debt?: number;
        credit_available?: number;
      };
      user: { full_name?: string };
      plans?: {
        meal_type: MealType;
        menu_item_id?: string | null;
        menu_item_name?: string | null;
      }[];
      cancellations?: { meal_type: MealType; cancel_date: string }[];
      date?: string;
    }>("/api/app/home");
    setItems(data.todayItems ?? []);
    setTomorrowItems(data.tomorrowItems ?? []);
    setPlans(data.plans ?? []);
    setCancellations(data.cancellations ?? []);
    if (data.settings) {
      setCutoffs({
        breakfast: String(data.settings.breakfast_cutoff),
        lunch: String(data.settings.lunch_cutoff),
        dinner: String(data.settings.dinner_cutoff),
      });
    }
    if (data.account) {
      const wallet = Number(data.account.wallet_credit);
      const limit = Number(data.account.credit_limit);
      setAccount({
        credit_limit: limit,
        wallet_credit: wallet,
        debt: Number(data.account.debt ?? Math.max(0, -wallet)),
        credit_available: Number(
          data.account.credit_available ?? wallet + limit
        ),
      });
    }
    if (data.user?.full_name) {
      setName(data.user.full_name.split(" ")[0] || "there");
    }
    if (data.date) {
      setSelectedDate((prev) => prev ?? addDaysYmd(data.date!, 1));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [load]);

  const { dateStr } = useMemo(() => getZonedParts(now), [now]);
  const tomorrowStr = useMemo(() => addDaysYmd(dateStr, 1), [dateStr]);
  const remaining = account.credit_available;
  const blocked = remaining <= 0;

  const calendarDates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDaysYmd(dateStr, i)),
    [dateStr]
  );

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    api<{ items: MenuItem[] }>(`/api/menu?date=${selectedDate}`)
      .then((data) => {
        if (!cancelled) setCalendarMenu(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setCalendarMenu([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    const next: Record<MealType, boolean> = {
      breakfast: false,
      lunch: false,
      dinner: false,
    };
    for (const c of cancellations) {
      if (c.cancel_date === selectedDate) next[c.meal_type] = true;
    }
    setSkipMeals(next);
  }, [selectedDate, cancellations]);

  async function place(item: MenuItem, orderDate: string, forTomorrow: boolean) {
    if (!forTomorrow && !isMealOpen(item.meal_type, cutoffs, now)) {
      setMsg(`${MEAL_LABELS[item.meal_type]} ordering is closed for today.`);
      return;
    }
    try {
      const data = await api<{ order: { payable_amount: number } }>("/api/orders", {
        method: "POST",
        json: {
          meal_type: item.meal_type,
          menu_item_id: item.id,
          quantity: qty[item.id] ?? 1,
          order_date: orderDate,
        },
      });
      setMsg(
        `Ordered ${qty[item.id] ?? 1}× ${item.name} · COD ${formatInr(Number(data.order.payable_amount))}`
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Order failed");
    }
  }

  async function submitSkips() {
    if (!selectedDate) return;
    const meal_types = (["breakfast", "lunch", "dinner"] as MealType[]).filter(
      (m) => skipMeals[m]
    );
    if (!meal_types.length) {
      setMsg("Select at least one meal to skip.");
      return;
    }
    setSkipBusy(true);
    try {
      await api("/api/plans/cancel-day", {
        method: "POST",
        json: { cancel_date: selectedDate, meal_types },
      });
      setMsg(`Skipped ${meal_types.join(", ")} on ${selectedDate}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Skip failed");
    } finally {
      setSkipBusy(false);
    }
  }

  function MealList({
    mealItems,
    orderDate,
    forTomorrow,
  }: {
    mealItems: MenuItem[];
    orderDate: string;
    forTomorrow: boolean;
  }) {
    const meals = (["breakfast", "lunch", "dinner"] as MealType[]).filter(
      (meal) => {
        const open = forTomorrow || isMealOpen(meal, cutoffs, now);
        const has = mealItems.some((i) => i.meal_type === meal);
        return forTomorrow ? has : open && has;
      }
    );

    if (!meals.length) {
      const anyOpenToday = (["breakfast", "lunch", "dinner"] as MealType[]).some(
        (m) => isMealOpen(m, cutoffs, now)
      );
      return (
        <p className="student-empty">
          {forTomorrow
            ? "No dishes published for tomorrow yet."
            : anyOpenToday && !mealItems.length
              ? "No dishes for today’s open meals."
              : "All meals for today are closed."}
        </p>
      );
    }

    return (
      <>
        {meals.map((meal) => {
          const open = forTomorrow || isMealOpen(meal, cutoffs, now);
          const mins = minutesUntilCutoff(meal, cutoffs, now);
          const list = mealItems.filter((i) => i.meal_type === meal);
          return (
            <div key={`${orderDate}-${meal}`} className="student-meal-block">
              <div className="student-meal-label">
                <strong>{MEAL_LABELS[meal]}</strong>
                <span className={`student-badge ${open || forTomorrow ? "ok" : "muted"}`}>
                  {forTomorrow
                    ? `Cutoff ${cutoffs[meal]} IST`
                    : open
                      ? formatCountdown(mins)
                      : "Closed"}
                </span>
              </div>
              {plans.some((p) => p.meal_type === meal) && (
                <p className="student-panel-note">
                  Covered by your plan
                  {plans.find((p) => p.meal_type === meal)?.menu_item_name
                    ? ` (${plans.find((p) => p.meal_type === meal)?.menu_item_name})`
                    : ""}
                  . Change combo under Plans. Buttons below are extra COD
                  orders only.
                </p>
              )}
              {list.map((item) => (
                <div key={item.id} className="student-dish">
                  <div>
                    <div className="student-dish-name">{item.name}</div>
                    {item.description ? (
                      <div className="student-dish-desc">{item.description}</div>
                    ) : null}
                    <div className="student-dish-price">
                      {formatInr(Number(item.price))}
                    </div>
                  </div>
                  <div className="student-dish-actions">
                    <div className="student-qty">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          setQty((q) => ({
                            ...q,
                            [item.id]: Math.max(1, (q[item.id] ?? 1) - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span>{qty[item.id] ?? 1}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          setQty((q) => ({
                            ...q,
                            [item.id]: Math.min(10, (q[item.id] ?? 1) + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="student-btn compact"
                      type="button"
                      disabled={blocked || (!forTomorrow && !open)}
                      onClick={() => place(item, orderDate, forTomorrow)}
                    >
                      {plans.some((p) => p.meal_type === meal)
                        ? "Extra · COD"
                        : "Add · COD"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="student-header">
          <div className="student-header-copy">
            <p className="student-kicker">Ahariva</p>
            <h1 className="student-title">Loading…</h1>
          </div>
        </div>
        <div className="student-panel">
          <div className="student-panel-body">
            <div className="student-skeleton" style={{ width: "40%" }} />
            <div className="student-skeleton" style={{ width: "90%", height: 64 }} />
            <div className="student-skeleton" style={{ width: "80%", height: 64 }} />
          </div>
        </div>
      </div>
    );
  }

  const planMeals = new Set(plans.map((p) => p.meal_type));

  return (
    <div>
      <div className="student-header">
        <div className="student-header-copy">
          <p className="student-kicker">Ahariva</p>
          <h1 className="student-title">Hi {name}</h1>
          <p className="student-muted" style={{ marginBottom: 0 }}>
            Wallet {formatInr(account.wallet_credit)}
            {account.debt > 0 ? ` · Debt ${formatInr(account.debt)}` : ""}
          </p>
        </div>
        <div className="student-credit-pill">
          <span>Available</span>
          <strong>{formatInr(remaining)}</strong>
        </div>
      </div>

      {msg && <div className="student-banner info">{msg}</div>}
      {blocked && (
        <div className="student-banner warn">
          Credit limit reached. Clear outstanding after COD collection.
        </div>
      )}

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>Today’s menu</h2>
          <span className="student-badge">{dateStr}</span>
        </div>
        <div className="student-panel-body">
          <MealList mealItems={items} orderDate={dateStr} forTomorrow={false} />
        </div>
      </section>

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>Tomorrow’s menu</h2>
          <span className="student-badge">{tomorrowStr}</span>
        </div>
        <div className="student-panel-body">
          <p className="student-panel-note">
            Order ahead now — meal cutoffs apply on that day.
          </p>
          <MealList
            mealItems={tomorrowItems}
            orderDate={tomorrowStr}
            forTomorrow={true}
          />
        </div>
      </section>

      <h2 className="student-section-title">Plan calendar</h2>
      <p className="student-muted">
        Browse meals by date, then skip the plan meals you won’t need.
      </p>

      <div className="student-cal-strip">
        {calendarDates.map((d) => {
          const active = selectedDate === d;
          const skipped = cancellations.some((c) => c.cancel_date === d);
          return (
            <button
              key={d}
              type="button"
              className={`student-cal-chip${active ? " active" : ""}${skipped ? " skipped" : ""}`}
              onClick={() => setSelectedDate(d)}
            >
              <strong>
                {d === dateStr ? "Today" : d === tomorrowStr ? "Tmrw" : weekdayLabel(d)}
              </strong>
              <span>{d.slice(5)}</span>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <section className="student-panel">
          <div className="student-panel-head">
            <h2>{weekdayLabel(selectedDate)}</h2>
            <span className="student-badge muted">{selectedDate}</span>
          </div>
          <div className="student-panel-body">
            {!calendarMenu.length && (
              <p className="student-empty">No dishes for this date yet.</p>
            )}
            {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
              const list = calendarMenu.filter((i) => i.meal_type === meal);
              if (!list.length) return null;
              return (
                <div key={`cal-${meal}`} className="student-meal-block">
                  <div className="student-meal-label">
                    <strong>{MEAL_LABELS[meal]}</strong>
                  </div>
                  {list.map((item) => (
                    <div key={item.id} className="student-dish">
                      <div>
                        <div className="student-dish-name">{item.name}</div>
                        <div className="student-dish-price">
                          {formatInr(Number(item.price))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {planMeals.size > 0 ? (
              <div style={{ marginTop: 8 }}>
                <strong>Skip plan meals</strong>
                <p className="student-panel-note">
                  Choose meals to skip on this date (before cutoff if today).
                </p>
                {(["breakfast", "lunch", "dinner"] as MealType[])
                  .filter((m) => planMeals.has(m))
                  .map((meal) => (
                    <label key={`skip-${meal}`} className="student-check">
                      <input
                        type="checkbox"
                        checked={skipMeals[meal]}
                        onChange={(e) =>
                          setSkipMeals((s) => ({
                            ...s,
                            [meal]: e.target.checked,
                          }))
                        }
                      />
                      <span>Skip {MEAL_LABELS[meal]}</span>
                    </label>
                  ))}
                <button
                  className="student-btn"
                  style={{ marginTop: 14 }}
                  type="button"
                  disabled={skipBusy}
                  onClick={submitSkips}
                >
                  {skipBusy ? "Saving…" : "Save skips"}
                </button>
              </div>
            ) : (
              <p className="student-empty" style={{ marginTop: 12 }}>
                No fixed plans yet — set them under Plans.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
