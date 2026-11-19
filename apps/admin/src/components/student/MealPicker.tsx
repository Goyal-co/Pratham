"use client";

import {
  MEAL_LABELS,
  formatCountdown,
  formatInr,
  isMealOpen,
  minutesUntilCutoff,
  type MealType,
  type MenuItem,
} from "@pratham/shared";
import { formatCutoffLabel } from "@/lib/student-ui";
import { resolvePublicMediaUrl } from "@/lib/media-url";

type Cutoffs = Record<MealType, string>;

export function MealPicker({
  mealItems,
  orderDate,
  forTomorrow,
  cutoffs,
  now,
  pick,
  qty,
  busyKey,
  blocked,
  onToggle,
  onQty,
  onClear,
  onConfirm,
}: {
  mealItems: MenuItem[];
  orderDate: string;
  forTomorrow: boolean;
  cutoffs: Cutoffs;
  now: Date;
  pick: Record<string, string>;
  qty: Record<string, number>;
  busyKey: string | null;
  blocked: boolean;
  onToggle: (orderDate: string, meal: MealType, itemId: string) => void;
  onQty: (key: string, next: number) => void;
  onClear: (key: string) => void;
  onConfirm: (
    meal: MealType,
    orderDate: string,
    forTomorrow: boolean,
    mealItems: MenuItem[]
  ) => void;
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
          : "No open meals with a published menu for today."}
      </p>
    );
  }

  return (
    <>
      {meals.map((meal) => {
        const open = forTomorrow || isMealOpen(meal, cutoffs, now);
        const mins = minutesUntilCutoff(meal, cutoffs, now);
        const list = mealItems.filter((i) => i.meal_type === meal);
        const key = `${orderDate}:${meal}`;
        const choice = pick[key] || "";
        const plates = qty[key] || 1;
        const unit = list.find((i) => i.id === choice);
        const total = unit != null ? Number(unit.price) * plates : null;
        return (
          <div key={key} className="student-meal-block">
            <div className="student-meal-label">
              <strong>{MEAL_LABELS[meal]}</strong>
              <CutoffBadge
                forTomorrow={forTomorrow}
                open={open}
                cutoff={cutoffs[meal]}
                mins={mins}
              />
            </div>
            <p className="student-panel-note">
              Pick one combo from kitchen’s menu (tap again to unselect). Add
              extra plates if needed, then confirm.
            </p>
            <div className="student-combo-list">
              {list.map((item) => {
                const active = choice === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`student-combo${active ? " active" : ""}`}
                    onClick={() => onToggle(orderDate, meal, item.id)}
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolvePublicMediaUrl(item.image_url)}
                        alt=""
                        className="student-combo-thumb"
                      />
                    ) : (
                      <span
                        className={`student-combo-tick${active ? " on" : ""}`}
                        aria-hidden
                      />
                    )}
                    <span className="student-combo-copy">
                      <strong>{item.name}</strong>
                      {item.description ? (
                        <div className="student-dish-desc">
                          {item.description}
                        </div>
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
                      onClick={() => onQty(key, Math.max(1, plates - 1))}
                    >
                      −
                    </button>
                    <span>{plates}</span>
                    <button
                      type="button"
                      aria-label="More plates"
                      disabled={plates >= 10}
                      onClick={() => onQty(key, Math.min(10, plates + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="student-btn secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => onClear(key)}
                >
                  Clear selection
                </button>
              </>
            ) : null}
            <button
              className="student-btn"
              style={{ marginTop: 10 }}
              type="button"
              disabled={
                blocked || !choice || busyKey === key || (!forTomorrow && !open)
              }
              onClick={() => onConfirm(meal, orderDate, forTomorrow, list)}
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

function CutoffBadge({
  forTomorrow,
  open,
  cutoff,
  mins,
}: {
  forTomorrow: boolean;
  open: boolean;
  cutoff: string;
  mins: number;
}) {
  return (
    <span className={`student-badge ${open || forTomorrow ? "ok" : "muted"}`}>
      {forTomorrow
        ? `Before ${formatCutoffLabel(cutoff)}`
        : open
          ? formatCountdown(mins)
          : "Closed"}
    </span>
  );
}
