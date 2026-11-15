"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@pratham/shared";
import { api } from "@/lib/http";

type Account = {
  credit_limit: number;
  outstanding_balance: number;
  wallet_credit: number;
};

type Ledger = {
  id: string;
  entry_type: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export default function StudentWalletPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api<{ account: Account; ledger: Ledger[] }>("/api/account");
    setAccount(data.account);
    setLedger(data.ledger ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  if (loading || !account) {
    return (
      <div>
        <p className="student-kicker">Ahariva</p>
        <h1 className="student-title">Wallet</h1>
        <div className="student-skeleton" style={{ height: 96 }} />
      </div>
    );
  }

  const remaining =
    Number(account.credit_limit) - Number(account.outstanding_balance);

  return (
    <div>
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Wallet</h1>
      <p className="student-muted">COD only · no online payments</p>

      <div className="student-panel">
        <div className="student-panel-body">
          <div className="student-row" style={{ justifyContent: "space-between" }}>
            <span className="student-muted" style={{ margin: 0 }}>
              Credit left
            </span>
            <strong style={{ fontSize: "1.15rem" }}>{formatInr(remaining)}</strong>
          </div>
          <div
            className="student-row"
            style={{ justifyContent: "space-between", marginTop: 10 }}
          >
            <span className="student-muted" style={{ margin: 0 }}>
              Outstanding
            </span>
            <strong>{formatInr(Number(account.outstanding_balance))}</strong>
          </div>
          <div
            className="student-row"
            style={{ justifyContent: "space-between", marginTop: 10 }}
          >
            <span className="student-muted" style={{ margin: 0 }}>
              Wallet credit
            </span>
            <strong>{formatInr(Number(account.wallet_credit))}</strong>
          </div>
          <p className="student-panel-note" style={{ marginTop: 12, marginBottom: 0 }}>
            Limit {formatInr(Number(account.credit_limit))}
          </p>
        </div>
      </div>

      <h2 className="student-section-title">Ledger</h2>
      {!ledger.length && <p className="student-empty">No entries yet.</p>}
      {ledger.map((l) => (
        <div key={l.id} className="student-card">
          <div className="student-row" style={{ justifyContent: "space-between" }}>
            <span className="student-badge">{l.entry_type}</span>
            <strong>{formatInr(Number(l.amount))}</strong>
          </div>
          <div className="student-muted" style={{ marginBottom: 0, marginTop: 6 }}>
            {l.note || "—"} · {new Date(l.created_at).toLocaleString("en-IN")}
          </div>
        </div>
      ))}
    </div>
  );
}
