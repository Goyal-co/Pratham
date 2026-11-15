"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  getZonedParts,
  type FixedPlan,
  type MealType,
} from "@pratham/shared";
import { api } from "@/lib/http";

export default function StudentPlansPage() {
  const [plans, setPlans] = useState<FixedPlan[]>([]);
  const [cancelDate, setCancelDate] = useState(getZonedParts().dateStr);
  const [skipMeals, setSkipMeals] = useState<Record<MealType, boolean>>({
    breakfast: true,
    lunch: true,
    dinner: true,
  });
  const [cutoffs, setCutoffs] = useState(DEFAULT_CUTOFFS);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [planData, settings] = await Promise.all([
      api<{ plans: FixedPlan[] }>("/api/plans"),
      api<{ settings: Record<string, string> }>("/api/settings"),
    ]);
    setPlans(planData.plans ?? []);
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

  async function apply(meal: MealType) {
    try {
      await api("/api/plans", { method: "POST", json: { meal_type: meal } });
      setMsg(`Everyday ${MEAL_LABELS[meal]} enabled.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function stop(meal: MealType) {
    try {
      await api(`/api/plans?meal_type=${meal}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function skipSelected() {
    const meal_types = (["breakfast", "lunch", "dinner"] as MealType[]).filter(
      (m) => skipMeals[m] && plans.some((p) => p.meal_type === m)
    );
    if (!meal_types.length) {
      setMsg("Select at least one active plan meal to skip.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/plans/cancel-day", {
        method: "POST",
        json: { meal_types, cancel_date: cancelDate },
      });
      setMsg(`Skipped ${meal_types.join(", ")} for ${cancelDate}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
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
        Skip before close (IST): B {cutoffs.breakfast} · L {cutoffs.lunch} · D{" "}
        {cutoffs.dinner}
      </p>
      {msg && <div className="student-banner info">{msg}</div>}

      <div className="student-card">
        <strong>Active</strong>
        {!plans.length && <p className="student-muted">None yet.</p>}
        {plans.map((p) => (
          <div key={p.id} style={{ textTransform: "capitalize", marginTop: 6 }}>
            Everyday {p.meal_type}
          </div>
        ))}
      </div>

      <div className="student-card" style={{ marginTop: 12 }}>
        <strong>Skip meals on a date</strong>
        <p className="student-muted" style={{ marginTop: 4 }}>
          Choose the date, then the meals to skip for that day.
        </p>
        <label className="student-field">
          Date
          <input
            value={cancelDate}
            onChange={(e) => setCancelDate(e.target.value)}
            type="date"
          />
        </label>
        {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
          const hasPlan = plans.some((p) => p.meal_type === meal);
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
                {MEAL_LABELS[meal]}
                {!hasPlan ? " (no plan)" : ""}
              </span>
            </label>
          );
        })}
        <button
          className="student-btn"
          style={{ marginTop: 12 }}
          type="button"
          disabled={busy || !plans.length}
          onClick={skipSelected}
        >
          {busy ? "Saving…" : "Skip selected meals"}
        </button>
      </div>

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => (
        <div className="student-card" key={meal}>
          <strong>{MEAL_LABELS[meal]}</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <button className="student-btn" type="button" onClick={() => apply(meal)}>
              Apply everyday {MEAL_LABELS[meal]}
            </button>
            <button
              className="student-btn danger"
              type="button"
              onClick={() => stop(meal)}
            >
              Stop plan
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
