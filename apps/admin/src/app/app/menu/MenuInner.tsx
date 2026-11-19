"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { resolvePublicMediaUrl } from "@/lib/media-url";
import { studentHref, useStudentBase } from "@/lib/student-paths";
import {
  addDaysYmd,
  formatCutoffLabel,
  SERVING_WINDOWS,
} from "@/lib/student-ui";
import { useNowTicker } from "@/components/student/NowTicker";

type CartLine = { item: MenuItem; quantity: number; orderDate: string };

export default function MenuInner() {
  const base = useStudentBase();
  const search = useSearchParams();
  const now = useNowTicker();
  const today = useMemo(() => getZonedParts(now).dateStr, [now]);
  const tomorrow = useMemo(() => addDaysYmd(today, 1), [today]);
  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [meal, setMeal] = useState<MealType>(
    (search.get("meal") as MealType) || "breakfast"
  );
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cutoffs, setCutoffs] = useState(DEFAULT_CUTOFFS);
  const [available, setAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const todayFullyClosed = useMemo(() => {
    return !(["breakfast", "lunch", "dinner"] as MealType[]).some((m) =>
      isMealOpen(m, cutoffs, now)
    );
  }, [cutoffs, now]);

  const openMealsToday = useMemo(
    () =>
      (["breakfast", "lunch", "dinner"] as MealType[]).filter((m) =>
        isMealOpen(m, cutoffs, now)
      ),
    [cutoffs, now]
  );

  const dates = useMemo(() => {
    // Hide today from the strip once every meal cutoff has passed
    const start = todayFullyClosed ? 1 : 0;
    return Array.from({ length: 7 - start }, (_, i) =>
      addDaysYmd(today, i + start)
    );
  }, [today, todayFullyClosed]);

  useEffect(() => {
    if (todayFullyClosed && selectedDate === today) {
      setSelectedDate(tomorrow);
    }
  }, [todayFullyClosed, selectedDate, today, tomorrow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings, account] = await Promise.all([
          api<{ settings: Record<string, string> }>("/api/settings"),
          api<{
            account?: {
              credit_available?: number;
              wallet_credit?: number;
              credit_limit?: number;
            };
          }>("/api/account").catch(() => ({ account: undefined })),
        ]);
        if (cancelled) return;
        if (settings.settings) {
          setCutoffs({
            breakfast: settings.settings.breakfast_cutoff,
            lunch: settings.settings.lunch_cutoff,
            dinner: settings.settings.dinner_cutoff,
          });
        }
        if (account.account) {
          const wallet = Number(account.account.wallet_credit ?? 0);
          const limit = Number(account.account.credit_limit ?? 0);
          setAvailable(
            Number(account.account.credit_available ?? wallet + limit)
          );
        }
      } catch {
        /* ignore bootstrap errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const menu = await api<{ items: MenuItem[] }>(
        `/api/menu?date=${selectedDate}`
      );
      setItems(menu.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadMenu().catch(() => setLoading(false));
  }, [loadMenu]);

  useEffect(() => {
    const m = search.get("meal") as MealType | null;
    if (m && ["breakfast", "lunch", "dinner"].includes(m)) setMeal(m);
  }, [search]);

  const orderableMeals = useMemo(() => {
    const all = ["breakfast", "lunch", "dinner"] as MealType[];
    if (selectedDate !== today) return all;
    return openMealsToday;
  }, [selectedDate, today, openMealsToday]);

  useEffect(() => {
    if (!orderableMeals.includes(meal)) {
      const firstWithItems = orderableMeals.find((m) =>
        items.some((i) => i.meal_type === m)
      );
      setMeal(firstWithItems || orderableMeals[0] || "breakfast");
      return;
    }
    if (!items.length) return;
    const hasCurrent = items.some((i) => i.meal_type === meal);
    if (hasCurrent) return;
    const first = orderableMeals.find((m) =>
      items.some((i) => i.meal_type === m)
    );
    if (first) setMeal(first);
  }, [items, meal, orderableMeals]);

  const list = items.filter((i) => i.meal_type === meal);
  const canOrder =
    selectedDate > today ||
    (selectedDate === today && isMealOpen(meal, cutoffs, now));

  const cartTotal = cart.reduce(
    (s, l) => s + Number(l.item.price) * l.quantity,
    0
  );
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  function openAdd(item: MenuItem) {
    setSheetItem(item);
    setQty(1);
  }

  function addToCart() {
    if (!sheetItem) return;
    setCart((c) => {
      const idx = c.findIndex(
        (l) => l.item.id === sheetItem.id && l.orderDate === selectedDate
      );
      if (idx >= 0) {
        const next = [...c];
        next[idx] = {
          ...next[idx],
          quantity: Math.min(10, next[idx].quantity + qty),
        };
        return next;
      }
      return [
        ...c,
        { item: sheetItem, quantity: qty, orderDate: selectedDate },
      ];
    });
    setSheetItem(null);
  }

  async function refreshAccount() {
    try {
      const account = await api<{
        account?: {
          credit_available?: number;
          wallet_credit?: number;
          credit_limit?: number;
        };
      }>("/api/account");
      if (account.account) {
        const wallet = Number(account.account.wallet_credit ?? 0);
        const limit = Number(account.account.credit_limit ?? 0);
        setAvailable(
          Number(account.account.credit_available ?? wallet + limit)
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function confirmCart() {
    if (!cart.length) return;
    if (available > 0 && cartTotal > available) {
      setMsg("Not enough available credit for this cart.");
      return;
    }
    setBusy(true);
    try {
      await Promise.all(
        cart.map((line) =>
          api("/api/orders", {
            method: "POST",
            json: {
              meal_type: line.item.meal_type,
              menu_item_id: line.item.id,
              quantity: line.quantity,
              order_date: line.orderDate,
            },
          })
        )
      );
      setMsg(
        `Ordered ${cartCount} plate${cartCount > 1 ? "s" : ""} · charged to wallet`
      );
      setCart([]);
      setCheckoutOpen(false);
      await Promise.all([loadMenu(), refreshAccount()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  function dateLabel(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const wd = dt.toLocaleDateString("en-IN", {
      weekday: "short",
      timeZone: "UTC",
    });
    const md = dt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    return { wd, md };
  }

  const mealCounts = useMemo(() => {
    const c: Record<MealType, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
    };
    for (const i of items) c[i.meal_type as MealType]++;
    return c;
  }, [items]);

  return (
    <div style={{ paddingBottom: cartCount ? 72 : 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 className="v2-page-title">Menu</h1>
          <p className="v2-page-sub">
            {todayFullyClosed
              ? "Today’s order window is closed — browse upcoming days."
              : "Only dishes kitchen added for the selected date."}
          </p>
        </div>
        <Link
          href={studentHref(base, "/notifications")}
          className="v2-avatar"
          style={{
            background: "var(--s-accent-soft)",
            color: "var(--s-accent)",
          }}
          aria-label="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M10 19a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </div>

      {msg && <div className="student-banner info">{msg}</div>}

      <div className="v2-date-strip">
        {dates.map((d) => {
          const { wd, md } = dateLabel(d);
          return (
            <button
              key={d}
              type="button"
              className={`v2-date-chip${selectedDate === d ? " active" : ""}`}
              onClick={() => setSelectedDate(d)}
            >
              <strong>
                {d === today ? "Today" : d === tomorrow ? "Tmrw" : wd}
              </strong>
              <span>{md}</span>
            </button>
          );
        })}
      </div>

      <div className="v2-meal-tabs">
        {orderableMeals.map((m) => (
          <button
            key={m}
            type="button"
            className={meal === m ? "active" : undefined}
            onClick={() => setMeal(m)}
          >
            {MEAL_LABELS[m]}
            {mealCounts[m] ? ` (${mealCounts[m]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="student-skeleton" style={{ height: 180 }} />
      ) : selectedDate === today && !canOrder ? (
        <div className="v2-info-box">
          {MEAL_LABELS[meal]} ordering is closed for today (cutoff{" "}
          {formatCutoffLabel(cutoffs[meal])} IST). Pick another day.
        </div>
      ) : !items.length ? (
        <div className="v2-info-box">
          No menu published for {selectedDate}. Kitchen adds day-specific dishes
          in admin — nothing shows here until then.
        </div>
      ) : !list.length ? (
        <div className="v2-info-box">
          No {MEAL_LABELS[meal].toLowerCase()} dishes for this date. Switch meal
          tab or pick another day.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <strong style={{ fontSize: "1.05rem" }}>{MEAL_LABELS[meal]}</strong>
            <span className={`student-badge ${canOrder ? "ok" : "muted"}`}>
              {canOrder ? "Available" : "Closed"}
            </span>
          </div>
          {list.map((item) => (
            <div key={item.id} className="v2-menu-card">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvePublicMediaUrl(item.image_url)}
                  alt={item.name}
                  className="v2-menu-photo"
                />
              ) : (
                <div className={`v2-menu-media ${meal}`}>{item.name}</div>
              )}
              <div className="v2-menu-body">
                <div className="row">
                  <div>
                    <h3>{item.name}</h3>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="v2-add"
                    disabled={!canOrder}
                    onClick={() => openAdd(item)}
                  >
                    ADD
                  </button>
                </div>
                <div className="v2-menu-meta">
                  <span>{formatInr(Number(item.price))}</span>
                  <span className="time">{SERVING_WINDOWS[meal]}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {cartCount > 0 && !checkoutOpen && (
        <div className="v2-cart-bar">
          <strong>
            {cartCount} item{cartCount > 1 ? "s" : ""} · {formatInr(cartTotal)}
          </strong>
          <button type="button" onClick={() => setCheckoutOpen(true)}>
            View Cart
          </button>
        </div>
      )}

      {sheetItem && (
        <div className="v2-sheet" onClick={() => setSheetItem(null)}>
          <div
            className="v2-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="v2-sheet-handle" />
            {sheetItem.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvePublicMediaUrl(sheetItem.image_url)}
                alt={sheetItem.name}
                className="v2-menu-photo"
                style={{ borderRadius: 14, marginBottom: 12 }}
              />
            ) : (
              <div
                className={`v2-menu-media ${sheetItem.meal_type}`}
                style={{ borderRadius: 14, marginBottom: 12 }}
              >
                {sheetItem.name}
              </div>
            )}
            <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem" }}>
              {sheetItem.name}
            </h2>
            {sheetItem.description ? (
              <p className="student-muted">{sheetItem.description}</p>
            ) : null}
            <p style={{ fontWeight: 800, margin: "8px 0 14px" }}>
              {formatInr(Number(sheetItem.price))} · before{" "}
              {formatCutoffLabel(cutoffs[sheetItem.meal_type as MealType])}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <span style={{ fontWeight: 700 }}>Plates</span>
              <div className="student-qty">
                <button
                  type="button"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span>{qty}</span>
                <button
                  type="button"
                  disabled={qty >= 10}
                  onClick={() => setQty((q) => Math.min(10, q + 1))}
                >
                  +
                </button>
              </div>
            </div>
            <button type="button" className="student-btn" onClick={addToCart}>
              Add · {formatInr(Number(sheetItem.price) * qty)}
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="v2-sheet" onClick={() => setCheckoutOpen(false)}>
          <div
            className="v2-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="v2-sheet-handle" />
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Cart</h2>
            {cart.map((line) => (
              <div
                key={`${line.item.id}-${line.orderDate}`}
                className="v2-order-row"
              >
                <div className="copy">
                  <strong>{line.item.name}</strong>
                  <span>
                    {MEAL_LABELS[line.item.meal_type as MealType]} ·{" "}
                    {line.orderDate} · {line.quantity} plate
                    {line.quantity > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="right">
                  <button
                    type="button"
                    className="v2-link"
                    onClick={() =>
                      setCart((c) =>
                        c.filter(
                          (l) =>
                            !(
                              l.item.id === line.item.id &&
                              l.orderDate === line.orderDate
                            )
                        )
                      )
                    }
                  >
                    Remove
                  </button>
                  <span className="amt">
                    {formatInr(Number(line.item.price) * line.quantity)}
                  </span>
                </div>
              </div>
            ))}
            <p className="student-muted" style={{ marginBottom: 6 }}>
              Available credit {formatInr(available)}
            </p>
            <p style={{ fontWeight: 800, margin: "8px 0 14px" }}>
              Total {formatInr(cartTotal)}
            </p>
            <button
              type="button"
              className="student-btn"
              disabled={busy || !cart.length}
              onClick={confirmCart}
            >
              {busy ? "Confirming…" : "Confirm Order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
