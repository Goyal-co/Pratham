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
  const [pick, setPick] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
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

  function pickKey(orderDate: string, meal: MealType) {
    return `${orderDate}:${meal}`;
  }

  function togglePick(orderDate: string, meal: MealType, itemId: string) {
    const key = pickKey(orderDate, meal);
    const clearing = pick[key] === itemId;
    setPick((p) => {
      if (clearing) {
        const next = { ...p };
        delete next[key];
        return next;
      }
      return { ...p, [key]: itemId };
    });
    setQty((q) => {
      if (clearing) {
        const next = { ...q };
        delete next[key];
        return next;
      }
      return { ...q, [key]: q[key] || 1 };
    });
  }

  async function confirmMeal(
    meal: MealType,
    orderDate: string,
    forTomorrow: boolean,
    mealItems: MenuItem[]
  ) {
    const key = pickKey(orderDate, meal);
    const itemId = pick[key];
    if (!itemId) {
      setMsg(`Pick one ${MEAL_LABELS[meal]} combo, then confirm.`);
      return;
    }
    const item = mealItems.find((i) => i.id === itemId);
    if (!item) return;
    if (!forTomorrow && !isMealOpen(meal, cutoffs, now)) {
      setMsg(`${MEAL_LABELS[meal]} ordering is closed for today.`);
      return;
    }
    const plates = Math.max(1, Math.min(10, qty[key] || 1));
    setBusyKey(key);
    try {
      const data = await api<{ order: { payable_amount: number; gross_amount?: number; quantity?: number } }>(
        "/api/orders",
        {
          method: "POST",
          json: {
            meal_type: meal,
            menu_item_id: item.id,
            quantity: plates,
            order_date: orderDate,
          },
        }
      );
      const charged = Number(
        data.order.gross_amount ??
          data.order.payable_amount ??
          Number(item.price) * plates
      );
      setMsg(
        `Ordered ${item.name} ×${plates} for ${orderDate} · ${formatInr(charged)} charged to wallet`
      );
      setPick((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      setQty((q) => {
        const next = { ...q };
        delete next[key];
        return next;
      });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusyKey(null);
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

  function MealPicker({
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
      return (
        <p className="student-empty">
          {forTomorrow
            ? "No combos published for tomorrow yet."
            : "No open meals with a menu for today."}
        </p>
      );
    }

    return (
      <>
        {meals.map((meal) => {
          const open = forTomorrow || isMealOpen(meal, cutoffs, now);
          const mins = minutesUntilCutoff(meal, cutoffs, now);
          const list = mealItems.filter((i) => i.meal_type === meal);
          const key = pickKey(orderDate, meal);
          const choice = pick[key] || "";
          const plates = qty[key] || 1;
          const unit = list.find((i) => i.id === choice);
          const total =
            unit != null ? Number(unit.price) * plates : null;
          return (
            <div key={key} className="student-meal-block">
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
              <p className="student-panel-note">
                Pick one combo (tap again to unselect). Add extra plates if
                needed, then confirm.
              </p>
              <div className="student-combo-list">
                {list.map((item) => {
                  const active = choice === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`student-combo${active ? " active" : ""}`}
                      onClick={() => togglePick(orderDate, meal, item.id)}
                    >
                      <span
                        className={`student-combo-tick${active ? " on" : ""}`}
                        aria-hidden
                      />
                      <span className="student-combo-copy">
                        <strong>{item.name}</strong>
                        {item.description ? (
                          <div className="student-dish-desc">{item.description}</div>
                        ) : null}
                      </span>
                      <span className="student-combo-price">
                        {formatInr(Number(item.price))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {choice ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div className="student-panel-note" style={{ margin: 0 }}>
                        Plates · extras ok
                      </div>
                      {total != null && (
                        <strong style={{ fontSize: "0.95rem" }}>
                          {formatInr(total)}
                        </strong>
                      )}
                    </div>
                    <div className="student-qty">
                      <button
                        type="button"
                        aria-label="Fewer plates"
                        disabled={plates <= 1}
                        onClick={() =>
                          setQty((q) => ({
                            ...q,
                            [key]: Math.max(1, plates - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span>{plates}</span>
                      <button
                        type="button"
                        aria-label="More plates"
                        disabled={plates >= 10}
                        onClick={() =>
                          setQty((q) => ({
                            ...q,
                            [key]: Math.min(10, plates + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="student-btn secondary"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setPick((p) => {
                        const next = { ...p };
                        delete next[key];
                        return next;
                      });
                      setQty((q) => {
                        const next = { ...q };
                        delete next[key];
                        return next;
                      });
                    }}
                  >
                    Clear selection
                  </button>
                </>
              ) : null}
              <button
                className="student-btn"
                style={{ marginTop: 10 }}
                type="button"
                disabled={blocked || !choice || busyKey === key || (!forTomorrow && !open)}
                onClick={() => confirmMeal(meal, orderDate, forTomorrow, list)}
              >
                {busyKey === key
                  ? "Ordering…"
                  : `Confirm · ${plates} plate${plates > 1 ? "s" : ""}`}
              </button>
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
          Credit limit reached. Pay cash to free available credit.
        </div>
      )}

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>Tomorrow</h2>
          <span className="student-badge">{tomorrowStr}</span>
        </div>
        <div className="student-panel-body">
          <p className="student-panel-note">
            Menu is published the day before. Pick one combo per meal, add
            extra plates if needed, then confirm to order.
          </p>
          <MealPicker
            mealItems={tomorrowItems}
            orderDate={tomorrowStr}
            forTomorrow={true}
          />
        </div>
      </section>

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>Today</h2>
          <span className="student-badge">{dateStr}</span>
        </div>
        <div className="student-panel-body">
          <MealPicker mealItems={items} orderDate={dateStr} forTomorrow={false} />
        </div>
      </section>

      <h2 className="student-section-title">Plan calendar</h2>
      <p className="student-muted">
        Only dates with a published day menu show dishes. Skip plan meals you
        don’t need.
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
              <p className="student-empty">
                No menu published for this date (only day-specific dishes show).
              </p>
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
                  Nothing is skipped by default — tick meals to skip.
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
                No fixed plans yet — confirm a combo under Plans.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
