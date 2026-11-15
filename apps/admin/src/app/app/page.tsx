"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  formatCountdown,
  formatInr,
  getOpenMeals,
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

export default function StudentHomePage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tomorrowItems, setTomorrowItems] = useState<MenuItem[]>([]);
  const [cutoffs, setCutoffs] = useState<Cutoffs>(DEFAULT_CUTOFFS);
  const [account, setAccount] = useState({
    credit_limit: 0,
    outstanding_balance: 0,
    wallet_credit: 0,
  });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("there");

  const load = useCallback(async () => {
    const today = getZonedParts().dateStr;
    const tomorrow = addDaysYmd(today, 1);
    const [menu, tomorrowMenu, settings, acct, me] = await Promise.all([
      api<{ items: MenuItem[] }>(`/api/menu?date=${today}`),
      api<{ items: MenuItem[] }>(`/api/menu?date=${tomorrow}`),
      api<{ settings: Record<string, string | number> }>("/api/settings"),
      api<{ account: typeof account }>("/api/account"),
      api<{ user: { full_name?: string } }>("/api/auth/me"),
    ]);
    setItems(menu.items ?? []);
    setTomorrowItems(tomorrowMenu.items ?? []);
    if (settings.settings) {
      setCutoffs({
        breakfast: String(settings.settings.breakfast_cutoff),
        lunch: String(settings.settings.lunch_cutoff),
        dinner: String(settings.settings.dinner_cutoff),
      });
    }
    if (acct.account) {
      setAccount({
        credit_limit: Number(acct.account.credit_limit),
        outstanding_balance: Number(acct.account.outstanding_balance),
        wallet_credit: Number(acct.account.wallet_credit),
      });
    }
    if (me.user?.full_name) setName(me.user.full_name.split(" ")[0] || "there");
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [load]);

  const { dateStr } = useMemo(() => getZonedParts(now), [now]);
  const tomorrowStr = useMemo(() => addDaysYmd(dateStr, 1), [dateStr]);
  const openMeals = useMemo(() => getOpenMeals(cutoffs, now), [cutoffs, now]);
  const remaining = account.credit_limit - account.outstanding_balance;
  const blocked = account.outstanding_balance >= account.credit_limit;

  async function place(item: MenuItem) {
    if (!isMealOpen(item.meal_type, cutoffs, now)) {
      setMsg(`${MEAL_LABELS[item.meal_type]} ordering is closed.`);
      return;
    }
    try {
      const data = await api<{ order: { payable_amount: number } }>("/api/orders", {
        method: "POST",
        json: {
          meal_type: item.meal_type,
          menu_item_id: item.id,
          quantity: qty[item.id] ?? 1,
          order_date: dateStr,
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

  if (loading) {
    return (
      <div>
        <h1 className="student-title">Home</h1>
        <p className="student-muted">Loading menu…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="student-title">Hi {name}</h1>
      <p className="student-muted">
        {dateStr} · Credit left {formatInr(remaining)} · Wallet{" "}
        {formatInr(account.wallet_credit)}
      </p>
      {msg && (
        <div className="student-card" style={{ borderColor: "var(--s-accent)" }}>
          {msg}
        </div>
      )}
      {blocked && (
        <div className="student-card" style={{ background: "#fff0ef" }}>
          Credit limit reached. Clear outstanding with COD collection.
        </div>
      )}

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
        const open = isMealOpen(meal, cutoffs, now);
        const mins = minutesUntilCutoff(meal, cutoffs, now);
        const mealItems = items.filter((i) => i.meal_type === meal);
        return (
          <div key={meal}>
            <div className="student-row" style={{ margin: "8px 0" }}>
              <strong style={{ textTransform: "capitalize" }}>
                {MEAL_LABELS[meal]}
              </strong>
              <span className="student-badge">
                {open ? formatCountdown(mins) : `Closed · ${cutoffs[meal]} IST`}
              </span>
            </div>
            {!mealItems.length && (
              <p className="student-muted">No dishes for this meal.</p>
            )}
            {mealItems.map((item) => (
              <div
                key={item.id}
                className="student-card"
                style={{ opacity: open ? 1 : 0.55 }}
              >
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                {item.description && (
                  <div className="student-muted">{item.description}</div>
                )}
                <div className="student-row" style={{ marginTop: 10 }}>
                  <strong>{formatInr(Number(item.price))}</strong>
                  <div className="student-qty" style={{ marginLeft: "auto" }}>
                    <button
                      type="button"
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
                </div>
                <button
                  className="student-btn"
                  style={{ marginTop: 10 }}
                  type="button"
                  disabled={!open || blocked}
                  onClick={() => place(item)}
                >
                  {open ? "Order COD" : "Closed"}
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {!openMeals.length && (
        <p className="student-muted">All meals closed for today.</p>
      )}

      <div style={{ marginTop: 28 }}>
        <h2 className="student-title" style={{ fontSize: "1.15rem" }}>
          Tomorrow’s menu
        </h2>
        <p className="student-muted">{tomorrowStr} · preview only</p>
        {!tomorrowItems.length && (
          <p className="student-muted">Not published yet.</p>
        )}
        {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
          const mealItems = tomorrowItems.filter((i) => i.meal_type === meal);
          if (!mealItems.length) return null;
          return (
            <div key={`tm-${meal}`}>
              <div className="student-row" style={{ margin: "8px 0" }}>
                <strong style={{ textTransform: "capitalize" }}>
                  {MEAL_LABELS[meal]}
                </strong>
              </div>
              {mealItems.map((item) => (
                <div key={`tm-${item.id}`} className="student-card">
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  {item.description && (
                    <div className="student-muted">{item.description}</div>
                  )}
                  <div className="student-row" style={{ marginTop: 8 }}>
                    <strong>{formatInr(Number(item.price))}</strong>
                    <span className="student-badge">Tomorrow</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
