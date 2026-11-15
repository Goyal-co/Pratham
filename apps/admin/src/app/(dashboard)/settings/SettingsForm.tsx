"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

type Settings = {
  breakfast_cutoff: string;
  lunch_cutoff: string;
  dinner_cutoff: string;
  referral_min_completed_orders: number;
  referral_reward_credits: number;
  default_credit_limit: number;
  reminder_lead_minutes?: number;
};

/** Normalize to HH:mm for storage / API */
function toHHmm(value: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return value.trim();
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...settings,
    breakfast_cutoff: toHHmm(settings.breakfast_cutoff),
    lunch_cutoff: toHHmm(settings.lunch_cutoff),
    dinner_cutoff: toHHmm(settings.dinner_cutoff),
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        json: {
          breakfast_cutoff: toHHmm(form.breakfast_cutoff),
          lunch_cutoff: toHHmm(form.lunch_cutoff),
          dinner_cutoff: toHHmm(form.dinner_cutoff),
          referral_min_completed_orders: Number(form.referral_min_completed_orders),
          referral_reward_credits: Number(form.referral_reward_credits),
          default_credit_limit: Number(form.default_credit_limit),
          reminder_lead_minutes: Number(form.reminder_lead_minutes ?? 30),
        },
      });
      alert("Order acceptance times and settings saved");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>
        Order acceptance closes at (IST)
      </h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        Students cannot place or skip that meal after this time. Example: set
        breakfast to <strong>05:00</strong> or <strong>06:00</strong> so the kitchen
        can prep.
      </p>
      <div className="row">
        <label className="field">
          Breakfast closes
          <input
            type="time"
            value={form.breakfast_cutoff}
            onChange={(e) =>
              setForm({ ...form, breakfast_cutoff: e.target.value })
            }
            required
          />
        </label>
        <label className="field">
          Lunch closes
          <input
            type="time"
            value={form.lunch_cutoff}
            onChange={(e) => setForm({ ...form, lunch_cutoff: e.target.value })}
            required
          />
        </label>
        <label className="field">
          Dinner closes
          <input
            type="time"
            value={form.dinner_cutoff}
            onChange={(e) => setForm({ ...form, dinner_cutoff: e.target.value })}
            required
          />
        </label>
      </div>

      <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>Referrals & credit</h3>
      <div className="row">
        <label className="field">
          Referral min orders (X)
          <input
            type="number"
            min={1}
            value={form.referral_min_completed_orders}
            onChange={(e) =>
              setForm({
                ...form,
                referral_min_completed_orders: Number(e.target.value),
              })
            }
            required
          />
        </label>
        <label className="field">
          Referral reward credits (Y)
          <input
            type="number"
            min={0}
            value={form.referral_reward_credits}
            onChange={(e) =>
              setForm({
                ...form,
                referral_reward_credits: Number(e.target.value),
              })
            }
            required
          />
        </label>
        <label className="field">
          Default credit limit
          <input
            type="number"
            min={0}
            value={form.default_credit_limit}
            onChange={(e) =>
              setForm({
                ...form,
                default_credit_limit: Number(e.target.value),
              })
            }
            required
          />
        </label>
        <label className="field">
          Closing reminder (minutes before)
          <input
            type="number"
            min={10}
            max={180}
            value={form.reminder_lead_minutes ?? 30}
            onChange={(e) =>
              setForm({
                ...form,
                reminder_lead_minutes: Number(e.target.value),
              })
            }
            required
          />
          <span className="muted" style={{ fontWeight: 400 }}>
            Push “closing soon” this many minutes before each cutoff.
          </span>
        </label>
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
