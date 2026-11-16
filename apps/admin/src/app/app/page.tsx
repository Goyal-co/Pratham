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
import {
  cachedStudentFetch,
  studentCacheInvalidate,
} from "@/lib/student-cache";
import {
  addDaysYmd,
  deliveryLine,
  formatCutoffLabel,
  greetingForNow,
  initialsOf,
  nextOrderableMeal,
  SERVING_WINDOWS,
} from "@/lib/student-ui";
import { AharivaLogo } from "@/components/student/AharivaLogo";
import { MealPicker } from "@/components/student/MealPicker";
import { useNowTicker } from "@/components/student/NowTicker";

type Cutoffs = Record<MealType, string>;

type HomePayload = {
  todayItems: MenuItem[];
  tomorrowItems: MenuItem[];
  settings: Record<string, string | number>;
  account: {
    credit_limit: number;
    wallet_credit: number;
    debt?: number;
    credit_available?: number;
  };
  user: {
    full_name?: string | null;
    hostel?: string | null;
    room?: string | null;
  };
  plans?: {
    meal_type: MealType;
    menu_item_id?: string | null;
    menu_item_name?: string | null;
  }[];
  cancellations?: { meal_type: MealType; cancel_date: string }[];
};

export default function StudentHomePage() {
  const base = useStudentBase();
  const now = useNowTicker();
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
  const [pick, setPick] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [user, setUser] = useState<{
    full_name?: string | null;
    hostel?: string | null;
    room?: string | null;
  }>({});

  const applyHome = useCallback((data: HomePayload) => {
    setItems(data.todayItems ?? []);
    setTomorrowItems(data.tomorrowItems ?? []);
    setPlans(data.plans ?? []);
    setCancellations(data.cancellations ?? []);
    setUser(data.user ?? {});
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
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (force) studentCacheInvalidate("home:");
      const data = await cachedStudentFetch<HomePayload>(
        "home:bootstrap",
        () => api<HomePayload>("/api/app/home"),
        force ? 0 : 45_000
      );
      applyHome(data);
      setLoading(false);
    },
    [applyHome]
  );

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, [load]);

  const { dateStr } = useMemo(() => getZonedParts(now), [now]);
  const tomorrowStr = useMemo(() => addDaysYmd(dateStr, 1), [dateStr]);
  const firstName = (user.full_name || "there").split(" ")[0];
  const hasPlan = plans.length > 0;
  const debt = account.debt;
  const blocked = account.credit_available <= 0;

  const featured = useMemo(
    () =>
      nextOrderableMeal({
        now,
        today: dateStr,
        tomorrow: tomorrowStr,
        cutoffs,
        todayItems: items,
        tomorrowItems,
      }),
    [now, dateStr, tomorrowStr, cutoffs, items, tomorrowItems]
  );

  const planMealsToday = useMemo(() => {
    return (["breakfast", "lunch", "dinner"] as MealType[])
      .filter((m) => plans.some((p) => p.meal_type === m))
      .map((meal) => {
        const skipped = cancellations.some(
          (c) => c.cancel_date === dateStr && c.meal_type === meal
        );
        const published = items.filter((i) => i.meal_type === meal);
        const dish =
          published[0]?.name ||
          plans.find((p) => p.meal_type === meal)?.menu_item_name ||
          null;
        return { meal, skipped, dish, combos: published };
      });
  }, [plans, cancellations, dateStr, items]);

  /** Only show Today order UI while at least one meal is still open. */
  const todayStillOpen = useMemo(() => {
    return (["breakfast", "lunch", "dinner"] as MealType[]).some(
      (m) =>
        isMealOpen(m, cutoffs, now) && items.some((i) => i.meal_type === m)
    );
  }, [cutoffs, now, items]);

  function togglePick(orderDate: string, meal: MealType, itemId: string) {
    const key = `${orderDate}:${meal}`;
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
    const key = `${orderDate}:${meal}`;
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
      const data = await api<{
        order: { payable_amount: number; gross_amount?: number };
      }>("/api/orders", {
        method: "POST",
        json: {
          meal_type: meal,
          menu_item_id: item.id,
          quantity: plates,
          order_date: orderDate,
        },
      });
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
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function skipToday(meal: MealType) {
    setBusyKey(`skip:${meal}`);
    try {
      await api("/api/plans/cancel-day", {
        method: "POST",
        json: { cancel_date: dateStr, meal_types: [meal] },
      });
      setMsg(`Skipped ${MEAL_LABELS[meal]} today`);
      studentCacheInvalidate("plans:");
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Skip failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="v2-brand-mark">
          <AharivaLogo height={32} />
        </div>
        <div className="student-skeleton" style={{ width: "55%", height: 28 }} />
        <div className="student-skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div>
      <p className="v2-loc">
        Delivering to {deliveryLine(user.hostel, user.room)}
      </p>

      <div className="v2-home-head">
        <div>
          <div className="v2-brand-mark">
            <AharivaLogo height={32} />
          </div>
          <h1>
            {greetingForNow(now)}, {firstName}!
          </h1>
        </div>
        <Link
          href={studentHref(base, "/profile")}
          className="v2-avatar"
          aria-label="Profile"
        >
          {initialsOf(user.full_name)}
        </Link>
      </div>

      {msg && <div className="student-banner info">{msg}</div>}
      {blocked && (
        <div className="student-banner warn">
          Credit limit reached. Pay cash to free available credit.
        </div>
      )}

      {hasPlan ? (
        <>
          <div className="v2-section-head">
            <h2>Your meals today</h2>
          </div>
          {planMealsToday.map(({ meal, skipped, dish, combos }) => (
            <div key={meal} className="v2-schedule-card">
              <div className="top">
                <h3>{MEAL_LABELS[meal]}</h3>
                <span className={`student-badge ${skipped ? "muted" : "ok"}`}>
                  {skipped ? "Skipped" : "Scheduled"}
                </span>
              </div>
              <p className="dish">
                {combos.length
                  ? combos.map((c) => c.name).join(" · ")
                  : dish || "Menu coming soon"}
              </p>
              <p className="meta">{SERVING_WINDOWS[meal]}</p>
              {!skipped && isMealOpen(meal, cutoffs, now) && (
                <button
                  type="button"
                  className="v2-link"
                  style={{ marginTop: 8 }}
                  disabled={!!busyKey}
                  onClick={() => skipToday(meal)}
                >
                  Skip
                </button>
              )}
            </div>
          ))}

          <div className="v2-quick-actions">
            <Link href={studentHref(base, "/meals")}>Manage Calendar</Link>
            <Link href={studentHref(base, "/menu")}>Order Extra</Link>
          </div>

          <Link href={studentHref(base, "/plans")} className="v2-promo">
            <span className="v2-promo-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 3.5v3.5M16 3.5v3.5M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <strong>
                {plans.map((p) => MEAL_LABELS[p.meal_type]).join(" + ")}
              </strong>
              <p>Your active meal plan</p>
            </div>
            <span className="v2-link">Manage</span>
          </Link>
        </>
      ) : featured ? (
        <div className={`v2-hero ${featured.meal}`}>
          <div className="v2-hero-body">
            <p className="v2-hero-eyebrow">{featured.label}</p>
            <h2>
              {featured.item?.name ||
                `${MEAL_LABELS[featured.meal]} menu is up`}
            </h2>
            <p>
              {featured.item
                ? `From kitchen menu · ${formatInr(Number(featured.item.price))} per plate`
                : "Pick a combo below to order"}
            </p>
            <div className="v2-hero-actions">
              <a href="#order-now" className="student-btn">
                Choose combo
              </a>
              <span className="v2-hero-cutoff">
                Order before {formatCutoffLabel(featured.cutoff)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="v2-empty">
          <h2>No published meals yet</h2>
          <p>
            When kitchen adds today’s or tomorrow’s menu, combos will show here.
          </p>
          <Link href={studentHref(base, "/menu")} className="student-btn">
            Check menu
          </Link>
        </div>
      )}

      <div className="v2-section-head">
        <h2>What are you craving?</h2>
        <Link href={studentHref(base, "/menu")} className="v2-link">
          See menu
        </Link>
      </div>
      <div className="v2-cats">
        {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
          const todayHas = items.some((i) => i.meal_type === meal);
          const tmrwHas = tomorrowItems.some((i) => i.meal_type === meal);
          const openToday = todayHas && isMealOpen(meal, cutoffs, now);
          return (
            <Link
              key={meal}
              href={studentHref(base, `/menu?meal=${meal}`)}
              className="v2-cat"
            >
              <div className={`v2-cat-media ${meal}`}>
                {MEAL_LABELS[meal].slice(0, 1)}
              </div>
              <strong>{MEAL_LABELS[meal]}</strong>
              <span className={openToday || tmrwHas ? undefined : "closed"}>
                {openToday
                  ? "Available"
                  : tmrwHas
                    ? "Tomorrow"
                    : "No menu"}
              </span>
            </Link>
          );
        })}
      </div>

      {!hasPlan && (
        <Link href={studentHref(base, "/plans")} className="v2-promo">
          <span className="v2-promo-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 3.5v3.5M16 3.5v3.5M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <strong>Your everyday meals, sorted.</strong>
            <p>Pick once. Skip any eligible day.</p>
          </div>
          <span className="v2-link">Explore</span>
        </Link>
      )}

      {debt > 0 && (
        <Link href={studentHref(base, "/wallet")} className="v2-due">
          <span className="v2-due-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <div>
            <strong>{formatInr(debt)} due</strong>
            <p>View your meal bill</p>
          </div>
          <span className="v2-link">View bill</span>
        </Link>
      )}

      {todayStillOpen ? (
        <section className="student-panel" id="order-now">
          <div className="student-panel-head">
            <h2>Today</h2>
            <span className="student-badge">{dateStr}</span>
          </div>
          <div className="student-panel-body">
            <p className="student-panel-note">
              Only open meals with a kitchen menu. Confirm places the order.
            </p>
            <MealPicker
              mealItems={items}
              orderDate={dateStr}
              forTomorrow={false}
              cutoffs={cutoffs}
              now={now}
              pick={pick}
              qty={qty}
              busyKey={busyKey}
              blocked={blocked}
              onToggle={togglePick}
              onQty={(key, next) => setQty((q) => ({ ...q, [key]: next }))}
              onClear={(key) => {
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
              onConfirm={confirmMeal}
            />
          </div>
        </section>
      ) : (
        <div className="v2-info-box" style={{ marginBottom: 14 }}>
          Today’s order window is closed. Order tomorrow’s meals below.
        </div>
      )}

      <section
        className="student-panel"
        id={todayStillOpen ? "order-tomorrow" : "order-now"}
      >
        <div className="student-panel-head">
          <h2>Tomorrow</h2>
          <span className="student-badge">{tomorrowStr}</span>
        </div>
        <div className="student-panel-body">
          <p className="student-panel-note">
            Only dishes added by kitchen for this date. Pick one combo per meal,
            extras allowed, confirm places the order.
          </p>
          <MealPicker
            mealItems={tomorrowItems}
            orderDate={tomorrowStr}
            forTomorrow={true}
            cutoffs={cutoffs}
            now={now}
            pick={pick}
            qty={qty}
            busyKey={busyKey}
            blocked={blocked}
            onToggle={togglePick}
            onQty={(key, next) => setQty((q) => ({ ...q, [key]: next }))}
            onClear={(key) => {
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
            onConfirm={confirmMeal}
          />
        </div>
      </section>
    </div>
  );
}
