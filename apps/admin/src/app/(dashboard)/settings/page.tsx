import { query } from "@pratham/db";
import { AppearanceSettings } from "./AppearanceSettings";
import { SettingsForm } from "./SettingsForm";
import { BroadcastForm } from "./BroadcastForm";

type SettingsRow = {
  breakfast_cutoff: string;
  lunch_cutoff: string;
  dinner_cutoff: string;
  referral_min_completed_orders: number;
  referral_reward_credits: number;
  default_credit_limit: number;
  reminder_lead_minutes?: number;
};

export default async function SettingsPage() {
  const { rows } = await query<SettingsRow>(
    `select * from app_settings where id = 1`
  );
  const settings = rows[0];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <p className="muted">
        Control when students can still place orders (IST), referral rewards, and
        default credit.
      </p>
      <AppearanceSettings />
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Order acceptance &amp; referrals</h2>
        {settings && <SettingsForm settings={settings} />}
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Broadcast push</h2>
        <BroadcastForm />
      </div>
    </div>
  );
}
