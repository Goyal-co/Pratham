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
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [menuByMeal, setMenuByMeal] = useState<Record<MealType, MenuItem[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
  });
  const [selected, setSelected] = useState<Partial<Record<MealType, string>>>({});
  const [cancelDate, setCancelDate] = useState(today);
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
    const tomorrow = addDaysYmd(getZonedParts().dateStr, 1);
    const [planData, settings, todayMenu, tomorrowMenu] = await Promise.all([
      api<{ plans: PlanRow[] }>("/api/plans"),
      api<{ settings: Record<string, string> }>("/api/settings"),
      api<{ items: MenuItem[] }>(`/api/menu?date=${getZonedParts().dateStr}`),
      api<{ items: MenuItem[] }>(`/api/menu?date=${tomorrow}`),
    ]);

    const merged: Record<MealType, MenuItem[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };
    const seen = new Set<string>();
    for (const item of [...(tomorrowMenu.items ?? []), ...(todayMenu.items ?? [])]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged[item.meal_type as MealType]?.push(item);
    }
    setMenuByMeal(merged);

    const nextPlans = planData.plans ?? [];
    setPlans(nextPlans);
    setSelected((prev) => {
      const next = { ...prev };
      for (const p of nextPlans) {
        if (p.menu_item_id) next[p.meal_type] = p.menu_item_id;
      }
      return next;
    });

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

  async function savePreference(meal: MealType) {
    const menuItemId = selected[meal];
    if (!menuItemId) {
      setMsg(`Pick a ${MEAL_LABELS[meal]} combo first.`);
      return;
    }
    setBusyMeal(meal);
    try {
      const data = await api<{
        charged: boolean;
        swapped_orders?: number;
        item?: { name: string };
      }>("/api/plans", {
        method: "POST",
        json: { meal_type: meal, menu_item_id: menuItemId },
      });
      const name = data.item?.name || "combo";
      setMsg(
        planMap[meal]
          ? `Updated ${MEAL_LABELS[meal]} to ${name}. ${
              data.swapped_orders
                ? `Open order(s) adjusted — credits refunded/reapplied.`
                : "No charge until the meal order is created."
            }`
          : `Everyday ${MEAL_LABELS[meal]} saved (${name}). Not charged yet — only when the daily order is created.`
      );
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
            ? ` · ${data.refunded_orders} open order(s) refunded to credit`
            : ""
        }`
      );
      setSelected((s) => {
        const next = { ...s };
        delete next[meal];
        return next;
      });
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
        <h1 className="student-title">Fixed plans</h1>
        <div className="student-skeleton" style={{ width: "60%" }} />
      </div>
    );
  }

  return (
    <div>
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Fixed plans</h1>
      <p className="student-muted">
        Pick a combo for each meal. Saving preference does not charge credits —
        you are charged only when that day’s order is created. Change combo
        anytime before cutoff; open orders are refunded and rebuilt.
      </p>
      <p className="student-muted">
        Cutoffs (IST): B {cutoffs.breakfast} · L {cutoffs.lunch} · D{" "}
        {cutoffs.dinner}
      </p>
      {msg && <div className="student-banner info">{msg}</div>}

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
        const plan = planMap[meal];
        const options = menuByMeal[meal];
        const choice = selected[meal] || plan?.menu_item_id || "";
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
                  Current combo: <strong>{plan.menu_item_name}</strong>
                  {plan.menu_item_price != null
                    ? ` · ${formatInr(Number(plan.menu_item_price))}`
                    : ""}
                </p>
              )}
              {!options.length && (
                <p className="student-empty">
                  No dishes published for this meal yet. Ask kitchen to add a
                  combo, then pick it here.
                </p>
              )}
              <div className="student-combo-list">
                {options.map((item) => {
                  const active = choice === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`student-combo${active ? " active" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`combo-${meal}`}
                        checked={active}
                        onChange={() =>
                          setSelected((s) => ({ ...s, [meal]: item.id }))
                        }
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
                    </label>
                  );
                })}
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button
                  className="student-btn"
                  type="button"
                  disabled={!!busyMeal || !choice}
                  onClick={() => savePreference(meal)}
                >
                  {busyMeal === meal
                    ? "Saving…"
                    : plan
                      ? "Update combo"
                      : "Save combo & enable plan"}
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
            Choose meals to skip. If an order was already created, it is
            cancelled and credits are restored.
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
