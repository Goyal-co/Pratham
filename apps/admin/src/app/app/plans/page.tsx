"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  formatInr,
  getZonedParts,
  type MealType,
  type MenuItem,
} from "@pratham/shared";
import { api } from "@/lib/http";

type PlanRow = {
  id: string;
  meal_type: MealType;
  menu_item_id: string | null;
  menu_item_name?: string | null;
  menu_item_price?: number | string | null;
};

function addDaysYmd(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export default function StudentPlansPage() {
  const today = getZonedParts().dateStr;
  const tomorrow = addDaysYmd(today, 1);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [menuByMeal, setMenuByMeal] = useState<Record<MealType, MenuItem[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
  });
  /** Explicit pick per meal — "" means cleared / none. Missing key = none selected. */
  const [selected, setSelected] = useState<Partial<Record<MealType, string>>>({});
  const [qty, setQty] = useState<Partial<Record<MealType, number>>>({});
  const [cancelDate, setCancelDate] = useState(tomorrow);
  const [skipMeals, setSkipMeals] = useState<Record<MealType, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [cutoffs, setCutoffs] = useState(DEFAULT_CUTOFFS);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMeal, setBusyMeal] = useState<MealType | null>(null);
  const [skipBusy, setSkipBusy] = useState(false);

  const load = useCallback(async () => {
    const day = addDaysYmd(getZonedParts().dateStr, 1);
    const [planData, settings, tomorrowMenu] = await Promise.all([
      api<{ plans: PlanRow[] }>("/api/plans"),
      api<{ settings: Record<string, string> }>("/api/settings"),
      api<{ items: MenuItem[] }>(`/api/menu?date=${day}`),
    ]);

    const merged: Record<MealType, MenuItem[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };
    for (const item of tomorrowMenu.items ?? []) {
      merged[item.meal_type as MealType]?.push(item);
    }
    setMenuByMeal(merged);
    setPlans(planData.plans ?? []);
    // Do not auto-select combos — plan = three meal slots, user picks one combo each.
    setSelected({});
    setQty({});

    if (settings.settings) {
      setCutoffs({
        breakfast: settings.settings.breakfast_cutoff,
        lunch: settings.settings.lunch_cutoff,
        dinner: settings.settings.dinner_cutoff,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const planMap = useMemo(() => {
    const m = {} as Partial<Record<MealType, PlanRow>>;
    for (const p of plans) m[p.meal_type] = p;
    return m;
  }, [plans]);

  function toggleCombo(meal: MealType, itemId: string) {
    setSelected((s) => {
      if (s[meal] === itemId) {
        return { ...s, [meal]: "" };
      }
      return { ...s, [meal]: itemId };
    });
  }

  async function confirmOrder(meal: MealType) {
    const menuItemId = selected[meal];
    if (!menuItemId) {
      setMsg(`Pick one ${MEAL_LABELS[meal]} combo, then confirm.`);
      return;
    }
    const plates = Math.max(1, Math.min(10, qty[meal] || 1));
    setBusyMeal(meal);
    try {
      const data = await api<{
        ordered: boolean;
        order_date: string;
        quantity?: number;
        item?: { name: string; price: number };
      }>("/api/plans", {
        method: "POST",
        json: {
          meal_type: meal,
          menu_item_id: menuItemId,
          quantity: plates,
          place_order: true,
          order_date: tomorrow,
        },
      });
      const n = data.quantity || plates;
      setMsg(
        `Confirmed ${MEAL_LABELS[meal]}: ${data.item?.name || "combo"} ×${n} for ${data.order_date} · charged to wallet`
      );
      setSelected((s) => ({ ...s, [meal]: "" }));
      setQty((q) => ({ ...q, [meal]: 1 }));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyMeal(null);
    }
  }

  async function stop(meal: MealType) {
    setBusyMeal(meal);
    try {
      const data = await api<{ refunded_orders?: number }>(
        `/api/plans?meal_type=${meal}`,
        { method: "DELETE" }
      );
      setMsg(
        `Stopped ${MEAL_LABELS[meal]} plan${
          data.refunded_orders
            ? ` · ${data.refunded_orders} open order(s) refunded`
            : ""
        }`
      );
      setSelected((s) => ({ ...s, [meal]: "" }));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyMeal(null);
    }
  }

  async function skipSelected() {
    const meal_types = (["breakfast", "lunch", "dinner"] as MealType[]).filter(
      (m) => skipMeals[m] && planMap[m]
    );
    if (!meal_types.length) {
      setMsg("Select at least one active plan meal to skip.");
      return;
    }
    setSkipBusy(true);
    try {
      const data = await api<{ refunded_orders?: number }>(
        "/api/plans/cancel-day",
        {
          method: "POST",
          json: { meal_types, cancel_date: cancelDate },
        }
      );
      setMsg(
        `Skipped ${meal_types.join(", ")} for ${cancelDate}${
          data.refunded_orders
            ? ` · ${data.refunded_orders} order(s) refunded`
            : ""
        }`
      );
      setSkipMeals({ breakfast: false, lunch: false, dinner: false });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSkipBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <p className="student-kicker">Ahariva</p>
        <h1 className="student-title">Plans</h1>
        <div className="student-skeleton" style={{ width: "60%" }} />
      </div>
    );
  }

  return (
    <div>
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Plans</h1>
      <p className="student-muted">
        Plan covers breakfast, lunch & dinner as three meal times. For tomorrow (
        {tomorrow}), pick <strong>one combo</strong> per meal, set plates
        (extras allowed), then confirm — that places the order. Tap again to
        unselect.
      </p>
      <p className="student-muted">
        Cutoffs (IST): B {cutoffs.breakfast} · L {cutoffs.lunch} · D{" "}
        {cutoffs.dinner}
      </p>
      {msg && <div className="student-banner info">{msg}</div>}

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
        const plan = planMap[meal];
        const options = menuByMeal[meal];
        const choice = selected[meal] || "";
        const plates = qty[meal] || 1;
        const unit = options.find((i) => i.id === choice);
        const total =
          unit != null ? Number(unit.price) * plates : null;
        return (
          <section className="student-panel" key={meal}>
            <div className="student-panel-head">
              <h2>{MEAL_LABELS[meal]}</h2>
              <span className={`student-badge ${plan ? "ok" : "muted"}`}>
                {plan ? "Plan on" : "No plan"}
              </span>
            </div>
            <div className="student-panel-body">
              {plan?.menu_item_name && (
                <p className="student-panel-note">
                  Last confirmed: <strong>{plan.menu_item_name}</strong>
                  {plan.menu_item_price != null
                    ? ` · ${formatInr(Number(plan.menu_item_price))}`
                    : ""}
                </p>
              )}
              {!options.length && (
                <p className="student-empty">
                  No combos for tomorrow yet. Kitchen adds tomorrow’s menu the
                  day before.
                </p>
              )}
              <div className="student-combo-list">
                {options.map((item) => {
                  const active = choice === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`student-combo${active ? " active" : ""}`}
                      onClick={() => toggleCombo(meal, item.id)}
                    >
                      <span
                        className={`student-combo-tick${active ? " on" : ""}`}
                        aria-hidden
                      />
                      <span className="student-combo-copy">
                        <strong>{item.name}</strong>
                        {item.description ? (
                          <span className="student-dish-desc">
                            {item.description}
                          </span>
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
                            [meal]: Math.max(1, plates - 1),
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
                            [meal]: Math.min(10, plates + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="student-btn secondary"
                    style={{ marginTop: 8 }}
                    type="button"
                    onClick={() => {
                      setSelected((s) => ({ ...s, [meal]: "" }));
                      setQty((q) => ({ ...q, [meal]: 1 }));
                    }}
                  >
                    Clear selection
                  </button>
                </>
              ) : null}
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button
                  className="student-btn"
                  type="button"
                  disabled={!!busyMeal || !choice}
                  onClick={() => confirmOrder(meal)}
                >
                  {busyMeal === meal
                    ? "Ordering…"
                    : `Confirm · ${plates} plate${plates > 1 ? "s" : ""} for ${tomorrow}`}
                </button>
                {plan && (
                  <button
                    className="student-btn danger"
                    type="button"
                    disabled={!!busyMeal}
                    onClick={() => stop(meal)}
                  >
                    Stop plan & refund open orders
                  </button>
                )}
              </div>
            </div>
          </section>
        );
      })}

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>Skip meals on a date</h2>
        </div>
        <div className="student-panel-body">
          <p className="student-panel-note">
            Opt in per meal (nothing selected by default).
          </p>
          <label className="student-field">
            Date
            <input
              value={cancelDate}
              onChange={(e) => setCancelDate(e.target.value)}
              type="date"
              min={today}
            />
          </label>
          {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
            const hasPlan = !!planMap[meal];
            return (
              <label
                key={meal}
                className="student-check"
                style={{ opacity: hasPlan ? 1 : 0.45 }}
              >
                <input
                  type="checkbox"
                  disabled={!hasPlan}
                  checked={!!skipMeals[meal] && hasPlan}
                  onChange={(e) =>
                    setSkipMeals((s) => ({ ...s, [meal]: e.target.checked }))
                  }
                />
                <span>
                  Skip {MEAL_LABELS[meal]}
                  {!hasPlan ? " (no plan)" : ""}
                </span>
              </label>
            );
          })}
          <button
            className="student-btn"
            style={{ marginTop: 12 }}
            type="button"
            disabled={skipBusy || !plans.length}
            onClick={skipSelected}
          >
            {skipBusy ? "Saving…" : "Skip selected meals"}
          </button>
        </div>
      </section>
    </div>
  );
}
