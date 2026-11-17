"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@pratham/shared";
import { api } from "@/lib/http";

type Referral = {
  id: string;
  invitee_name: string;
  invitee_email: string | null;
  status: string;
  completed_orders: number;
  needed_orders: number;
  earned_at: string | null;
  created_at: string;
};

type Payload = {
  code: string;
  campaign: {
    title: string;
    headline: string;
    description: string;
    reward_credits: number;
    min_completed_orders: number;
    steps: string[];
    rules: string[];
  };
  summary: {
    invited: number;
    pending: number;
    earned: number;
    credits_earned: number;
    reward_per_friend: number;
  };
  referrals: Referral[];
};

function statusLabel(status: string) {
  if (status === "earned") return "Earned";
  if (status === "pending") return "In progress";
  if (status === "ineligible") return "Ineligible";
  return status;
}

function statusClass(status: string) {
  if (status === "earned") return "ok";
  if (status === "pending") return "";
  return "muted";
}

export default function ReferEarnPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<Payload>("/api/referrals");
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function copyCode() {
    if (!data?.code) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setMsg("Could not copy — select the code manually");
    }
  }

  async function shareCode() {
    if (!data?.code) return;
    const text = `Join Ahariva with my code ${data.code} and get homemade meals delivered. I earn credit when you complete your first meals!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ahariva invite", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg("Invite text copied");
    } catch {
      /* user cancelled share */
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="v2-page-title">Refer & Earn</h1>
        <div className="student-skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="v2-page-title">Refer & Earn</h1>
        <p className="student-empty">Could not load referral campaign.</p>
      </div>
    );
  }

  const { campaign, summary, referrals, code } = data;

  return (
    <div>
      <h1 className="v2-page-title">{campaign.title}</h1>
      <p className="v2-page-sub">{campaign.headline}</p>
      {msg && <div className="student-banner info">{msg}</div>}

      <section className="student-panel">
        <div className="student-panel-body">
          <p className="student-panel-note" style={{ marginTop: 0 }}>
            {campaign.description}
          </p>
          <p className="student-panel-note">Your invite code</p>
          <div className="v2-refer-code">
            <span>{code}</span>
            <button type="button" className="v2-link" onClick={copyCode}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            className="student-btn"
            style={{ marginTop: 12 }}
            onClick={shareCode}
          >
            Share invite
          </button>
        </div>
      </section>

      <div className="v2-refer-stats">
        <div>
          <strong>{summary.invited}</strong>
          <span>Invited</span>
        </div>
        <div>
          <strong>{summary.pending}</strong>
          <span>Pending</span>
        </div>
        <div>
          <strong>{summary.earned}</strong>
          <span>Earned</span>
        </div>
        <div>
          <strong>{formatInr(summary.credits_earned)}</strong>
          <span>Credits</span>
        </div>
      </div>

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>How it works</h2>
        </div>
        <div className="student-panel-body">
          <ol className="v2-refer-steps">
            {campaign.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>Campaign details</h2>
        </div>
        <div className="student-panel-body">
          <p className="student-panel-note" style={{ marginTop: 0 }}>
            Reward per successful referral:{" "}
            <strong>{formatInr(campaign.reward_credits)}</strong>
          </p>
          <p className="student-panel-note">
            Friend must complete{" "}
            <strong>{campaign.min_completed_orders}</strong> delivered meal
            {campaign.min_completed_orders === 1 ? "" : "s"} before credit unlocks.
          </p>
          <ul className="v2-refer-rules">
            {campaign.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>People you referred</h2>
        </div>
        <div className="student-panel-body">
          {!referrals.length && (
            <p className="student-empty">
              No referrals yet — share your code to get started.
            </p>
          )}
          {referrals.map((r) => {
            const progress = Math.min(
              100,
              Math.round((r.completed_orders / Math.max(1, r.needed_orders)) * 100)
            );
            return (
              <div key={r.id} className="v2-refer-row">
                <div className="top">
                  <div>
                    <strong>{r.invitee_name}</strong>
                    {r.invitee_email ? (
                      <span className="meta">{r.invitee_email}</span>
                    ) : null}
                  </div>
                  <span className={`student-badge ${statusClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </div>
                {r.status === "pending" ? (
                  <>
                    <p className="meta">
                      {r.completed_orders}/{r.needed_orders} delivered meals
                    </p>
                    <div className="v2-refer-bar">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </>
                ) : r.status === "earned" ? (
                  <p className="meta">
                    Credited {formatInr(summary.reward_per_friend)}
                    {r.earned_at
                      ? ` · ${new Date(r.earned_at).toLocaleDateString("en-IN")}`
                      : ""}
                  </p>
                ) : (
                  <p className="meta">Not eligible for reward</p>
                )}
                <p className="meta">
                  Joined {new Date(r.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
