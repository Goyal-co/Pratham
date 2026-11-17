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
import { cachedStudentFetch, studentCacheInvalidate } from "@/lib/student-cache";

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

  const load = useCallback(async (force = false) => {
    const day = addDaysYmd(getZonedParts().dateStr, 1);
    if (force) {
      studentCacheInvalidate("plans:");
      studentCacheInvalidate("home:");
    }
    try {
      const [planData, settings, tomorrowMenu] = await Promise.all([
        cachedStudentFetch(
          "plans:list",
          () => api<{ plans: PlanRow[] }>("/api/plans"),
          force ? 0 : 45_000
        ).catch(() => ({ plans: [] as PlanRow[] })),
        cachedStudentFetch(
          "plans:settings",
          () => api<{ settings: Record<string, string> }>("/api/settings"),
          force ? 0 : 60_000
        ).catch(() => ({ settings: {} as Record<string, string> })),
        api<{ items: MenuItem[] }>(`/api/menu?date=${day}`).catch(() => ({
          items: [] as MenuItem[],
        })),
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
      setSelected({});
      setQty({});

      if (settings.settings) {
        setCutoffs({
          breakfast:
            settings.settings.breakfast_cutoff || DEFAULT_CUTOFFS.breakfast,
          lunch: settings.settings.lunch_cutoff || DEFAULT_CUTOFFS.lunch,
          dinner: settings.settings.dinner_cutoff || DEFAULT_CUTOFFS.dinner,
        });
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const skip = new URLSearchParams(window.location.search).get("skip");
    if (skip && /^\d{4}-\d{2}-\d{2}$/.test(skip)) setCancelDate(skip);
  }, []);

  const planMap = useMemo(() => {
    const m = {} as Partial<Record<MealType, PlanRow>>;
    for (const p of plans) m[p.meal_type] = p;
    return m;
  }, [plans]);

  function toggleCombo(meal: MealType, itemId: string) {
    setSelected((s) => {
      if (s[meal] === itemId) return { ...s, [meal]: "" };
      return { ...s, [meal]: itemId };
    });
  }

  async function savePlan(meal: MealType, placeOrder: boolean) {
    const menuItemId = selected[meal] || planMap[meal]?.menu_item_id || null;
    if (placeOrder && !menuItemId) {
      setMsg(`Pick one ${MEAL_LABELS[meal]} combo, then confirm.`);
      return;
    }
    const plates = Math.max(1, Math.min(10, qty[meal] || 1));
    setBusyMeal(meal);
    try {
      const data = await api<{
        ordered: boolean;
        order_date: string;
        order_error?: string | null;
        quantity?: number;
        item?: { name: string; price: number } | null;
      }>("/api/plans", {
        method: "POST",
        json: {
          meal_type: meal,
          menu_item_id: menuItemId,
          quantity: plates,
          place_order: placeOrder,
          order_date: tomorrow,
        },
      });
      if (placeOrder && data.ordered) {
        const n = data.quantity || plates;
        setMsg(
          `Ordered ${MEAL_LABELS[meal]}: ${data.item?.name || "combo"} ×${n} for ${data.order_date} · charged to wallet`
        );
      } else if (placeOrder && data.order_error) {
        setMsg(
          `${MEAL_LABELS[meal]} added to your plan, but order failed: ${data.order_error}`
        );
      } else {
        setMsg(
          `${MEAL_LABELS[meal]} is on your meal plan${
            data.item?.name ? ` · preferred ${data.item.name}` : ""
          }`
        );
      }
      setSelected((s) => ({ ...s, [meal]: "" }));
      setQty((q) => ({ ...q, [meal]: 1 }));
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
      await load(true).catch(() => undefined);
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
      await load(true);
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
      setMsg("Turn on a meal plan above, then choose meals to skip.");
      return;
    }
    setSkipBusy(true);
    try {
      const data = await api<{
        cancelled?: string[];
        skipped?: string[];
        refunded_orders?: number;
      }>("/api/plans/cancel-day", {
        method: "POST",
        json: { meal_types, cancel_date: cancelDate },
      });
      const done = data.cancelled?.length
        ? data.cancelled.join(", ")
        : meal_types.join(", ");
      const partial = data.skipped?.length
        ? ` · skipped: ${data.skipped.join("; ")}`
        : "";
      setMsg(
        `Skipped ${done} for ${cancelDate}${
          data.refunded_orders
            ? ` · ${data.refunded_orders} order(s) refunded`
            : ""
        }${partial}`
      );
      setSkipMeals((s) => {
        const next = { ...s };
        for (const m of data.cancelled || []) {
          next[m as MealType] = false;
        }
        return next;
      });
      studentCacheInvalidate("home:");
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSkipBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="v2-page-title">Build your meal plan</h1>
        <div className="student-skeleton" style={{ width: "60%" }} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="v2-page-title">Build your meal plan</h1>
      <p className="v2-page-sub">
        Turn on breakfast, lunch, or dinner for everyday delivery. Then skip any
        date you don&apos;t need — or confirm tomorrow&apos;s combo when the
        kitchen publishes it.
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
        const total = unit != null ? Number(unit.price) * plates : null;
        return (
          <section className="student-panel" key={meal}>
            <div className="student-panel-head">
              <h2>{MEAL_LABELS[meal]}</h2>
              <span className={`student-badge ${plan ? "ok" : "muted"}`}>
                {plan ? "Plan on" : "Off"}
              </span>
            </div>
            <div className="student-panel-body">
              {plan?.menu_item_name && (
                <p className="student-panel-note">
                  Preferred: <strong>{plan.menu_item_name}</strong>
                  {plan.menu_item_price != null
                    ? ` · ${formatInr(Number(plan.menu_item_price))}`
                    : ""}
                </p>
              )}
              {!options.length && (
                <p className="student-empty">
                  No {MEAL_LABELS[meal].toLowerCase()} dishes for tomorrow yet.
                  You can still add this meal to your plan and skip dates.
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
                  disabled={!!busyMeal}
                  onClick={() => savePlan(meal, false)}
                >
                  {busyMeal === meal
                    ? "Saving…"
                    : plan
                      ? `Update ${MEAL_LABELS[meal]} plan`
                      : `Add ${MEAL_LABELS[meal]} to my plan`}
                </button>
                <button
                  className="student-btn secondary"
                  type="button"
                  disabled={!!busyMeal || !choice}
                  onClick={() => savePlan(meal, true)}
                >
                  {busyMeal === meal
                    ? "Ordering…"
                    : `Confirm & order · ${plates} plate${plates > 1 ? "s" : ""} for ${tomorrow}`}
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
            Pick a date and the plan meals you want to skip. Add meals to your
            plan above first.
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
                  {!hasPlan ? " (add to plan first)" : ""}
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
