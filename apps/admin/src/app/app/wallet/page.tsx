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

export default function StudentWalletPage() {
  const today = getZonedParts().dateStr;
  const [account, setAccount] = useState<Account | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState("all");
  const [dateFrom, setDateFrom] = useState(today.slice(0, 8) + "01");
  const [dateTo, setDateTo] = useState(today);

  const load = useCallback(async () => {
    const data = await api<{ account: Account; ledger: Ledger[] }>("/api/account");
    setAccount(data.account);
    setLedger(data.ledger ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    return ledger.filter((l) => {
      const day = ymdLocal(new Date(l.created_at));
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (entryType !== "all" && l.entry_type !== entryType) return false;
      return true;
    });
  }, [ledger, dateFrom, dateTo, entryType]);

  if (loading || !account) {
    return (
      <div>
        <p className="student-kicker">Ahariva</p>
        <h1 className="student-title">Wallet</h1>
        <div className="student-skeleton" style={{ height: 96 }} />
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
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Wallet</h1>
      <p className="student-muted">All money moves through wallet</p>

      <div className="student-panel">
        <div className="student-panel-body">
          <div className="student-stat-grid">
            <div className="student-stat">
              <span>Wallet</span>
              <strong>{formatInr(wallet)}</strong>
            </div>
            <div className="student-stat">
              <span>Available</span>
              <strong>{formatInr(available)}</strong>
            </div>
            <div className="student-stat">
              <span>Credit limit</span>
              <strong>{formatInr(limit)}</strong>
            </div>
            <div className="student-stat">
              <span>Debt</span>
              <strong>{formatInr(debt)}</strong>
            </div>
          </div>
        </div>
      </div>

      <section className="student-panel">
        <div className="student-panel-head">
          <h2>How it works</h2>
        </div>
        <div className="student-panel-body">
          <p className="student-panel-note">
            <strong>Wallet</strong> — your main balance. Orders subtract here.
            Payments and rewards add here. It can go negative when you borrow.
          </p>
          <p className="student-panel-note">
            <strong>Credit limit</strong> — max you can borrow (how negative
            wallet can go). Available = wallet + credit limit.
          </p>
          <p className="student-panel-note" style={{ marginBottom: 0 }}>
            <strong>Debt</strong> — if wallet is negative, that amount is what
            you owe until you pay cash.
          </p>
        </div>
      </section>

      <h2 className="student-section-title">Transactions</h2>
      <div className="student-filter-row">
        <label className="student-field" style={{ marginBottom: 0 }}>
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="student-field" style={{ marginBottom: 0 }}>
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <label className="student-field" style={{ marginBottom: 0 }}>
          Type
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="order_charge">Order charge</option>
            <option value="cod_collection">Cash paid</option>
            <option value="referral_credit">Referral</option>
            <option value="adjustment">Adjustment</option>
            <option value="wallet_applied">Wallet applied</option>
          </select>
        </label>
      </div>

      {!filtered.length && <p className="student-empty">No transactions.</p>}
      {filtered.map((l) => (
        <div key={l.id} className="student-card">
          <div className="student-row" style={{ justifyContent: "space-between" }}>
            <span className="student-badge">{l.entry_type}</span>
            <strong
              style={{
                color: Number(l.amount) < 0 ? "var(--s-danger)" : "var(--s-ok)",
              }}
            >
              {formatInr(Number(l.amount))}
            </strong>
          </div>
          <div className="student-muted" style={{ marginBottom: 0, marginTop: 6 }}>
            {l.note || "—"}
          </div>
          <div className="student-muted" style={{ marginBottom: 0, fontSize: 11 }}>
            {new Date(l.created_at).toLocaleString("en-IN")}
            {l.order_id ? ` · order ${l.order_id.slice(0, 8)}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
