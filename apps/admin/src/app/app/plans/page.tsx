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
  const [cutoffs, setCutoffs] = useState(DEFAULT_CUTOFFS);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function skip(meal: MealType) {
    try {
      await api("/api/plans/cancel-day", {
        method: "POST",
        json: { meal_type: meal, cancel_date: cancelDate },
      });
      setMsg(`${MEAL_LABELS[meal]} skipped for ${cancelDate}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="student-title">Fixed plans</h1>
        <p className="student-muted">Loading plans…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="student-title">Fixed plans</h1>
      <p className="student-muted">
        Skip before close (IST): B {cutoffs.breakfast} · L {cutoffs.lunch} · D{" "}
        {cutoffs.dinner}
      </p>
      {msg && <div className="student-card">{msg}</div>}

      <div className="student-card">
        <strong>Active</strong>
        {!plans.length && <p className="student-muted">None yet.</p>}
        {plans.map((p) => (
          <div key={p.id} style={{ textTransform: "capitalize", marginTop: 6 }}>
            Everyday {p.meal_type}
          </div>
        ))}
      </div>

      <label className="student-field">
        Skip date (YYYY-MM-DD)
        <input
          value={cancelDate}
          onChange={(e) => setCancelDate(e.target.value)}
          type="date"
        />
      </label>

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => (
        <div className="student-card" key={meal}>
          <strong>{MEAL_LABELS[meal]}</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <button className="student-btn" type="button" onClick={() => apply(meal)}>
              Apply everyday {MEAL_LABELS[meal]}
            </button>
            <button
              className="student-btn secondary"
              type="button"
              onClick={() => skip(meal)}
            >
              Skip for date
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
