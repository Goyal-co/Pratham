"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInr, getZonedParts } from "@pratham/shared";
import { api } from "@/lib/http";

type Account = {
  credit_limit: number;
  wallet_credit: number;
  debt?: number;
  credit_available?: number;
};

type Ledger = {
  id: string;
  entry_type: string;
  amount: number;
  note: string | null;
  created_at: string;
  order_id?: string | null;
};

function ymdLocal(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function friendlyEntry(l: Ledger) {
  const type = l.entry_type;
  if (type === "order_charge") return "Meal charge";
  if (type === "cod_collection" || type === "wallet_topup") return "Payment received";
  if (type === "referral_credit") return "Referral credit";
  if (type.includes("refund")) return "Refund";
  if (type === "adjustment") return "Adjustment";
  return type.replaceAll("_", " ");
}

export default function StudentWalletPage() {
  const today = getZonedParts().dateStr;
  const [account, setAccount] = useState<Account | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showHow, setShowHow] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ account: Account; ledger: Ledger[] }>(
        "/api/account"
      );
      setAccount(data.account);
      setLedger(data.ledger ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    return ledger.filter((l) => {
      if (filter === "all") return true;
      if (filter === "charges") return l.entry_type === "order_charge";
      if (filter === "payments")
        return (
          l.entry_type === "cod_collection" ||
          l.entry_type === "wallet_topup" ||
          Number(l.amount) > 0
        );
      if (filter === "refunds") return l.entry_type.includes("refund");
      if (filter === "referrals") return l.entry_type === "referral_credit";
      if (filter === "adjustments") return l.entry_type === "adjustment";
      return true;
    });
  }, [ledger, filter]);

  if (loading || !account) {
    return (
      <div>
        <h1 className="v2-page-title">My Wallet</h1>
        <div className="student-skeleton" style={{ height: 140 }} />
      </div>
    );
  }

  const wallet = Number(account.wallet_credit);
  const limit = Number(account.credit_limit);
  const available =
    account.credit_available != null
      ? Number(account.credit_available)
      : wallet + limit;
  const debt =
    account.debt != null ? Number(account.debt) : Math.max(0, -wallet);

  return (
    <div>
      <h1 className="v2-page-title">My Wallet</h1>
      <p className="v2-page-sub">Pay dues · track meal charges</p>

      <div className="v2-wallet-hero">
        <span>Amount to Pay</span>
        <strong>{formatInr(debt)}</strong>
        <p>Your outstanding meal balance</p>
        <button type="button" className="student-btn" disabled={debt <= 0}>
          {debt > 0 ? "Pay Now" : "All clear"}
        </button>
        <p className="student-muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Pay cash to the delivery person or kitchen — admin will clear your bill.
        </p>
      </div>

      <div className="student-stat-grid" style={{ marginBottom: 14 }}>
        <div className="student-stat">
          <span>Available to spend</span>
          <strong>{formatInr(available)}</strong>
        </div>
        <div className="student-stat">
          <span>Credit limit</span>
          <strong>{formatInr(limit)}</strong>
        </div>
      </div>

      <button
        type="button"
        className="v2-link"
        style={{ marginBottom: 12 }}
        onClick={() => setShowHow((s) => !s)}
      >
        {showHow ? "Hide" : "How credit works"}
      </button>
      {showHow && (
        <div className="v2-info-box" style={{ marginBottom: 16 }}>
          Available to spend = wallet + credit limit. When wallet goes negative,
          that amount is what you owe (Amount to Pay). Orders stop when available
          reaches ₹0.
        </div>
      )}

      <div className="v2-section-head">
        <h2>Activity</h2>
      </div>
      <div className="v2-meal-tabs" style={{ marginBottom: 12 }}>
        {(
          [
            ["all", "All"],
            ["charges", "Meals"],
            ["payments", "Payments"],
            ["referrals", "Referrals"],
            ["refunds", "Refunds"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "active" : undefined}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {!filtered.length && (
        <p className="student-empty">No transactions in this filter.</p>
      )}
      {filtered.map((l) => (
        <div key={l.id} className="v2-order-row">
          <span
            className="v2-order-icon"
            style={{
              background:
                Number(l.amount) >= 0
                  ? "var(--s-ok-soft)"
                  : "var(--s-accent-soft)",
              color:
                Number(l.amount) >= 0 ? "var(--s-ok)" : "var(--s-accent)",
            }}
            aria-hidden
          >
            {Number(l.amount) >= 0 ? "+" : "−"}
          </span>
          <div className="copy">
            <strong>
              {l.note?.split("·")[0]?.trim() || friendlyEntry(l)}
            </strong>
            <span>
              {ymdLocal(new Date(l.created_at))} · {friendlyEntry(l)}
            </span>
          </div>
          <div className="right">
            <span
              className="amt"
              style={{
                color: Number(l.amount) >= 0 ? "var(--s-ok)" : "var(--s-ink)",
              }}
            >
              {Number(l.amount) >= 0 ? "+" : ""}
              {formatInr(Number(l.amount))}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
