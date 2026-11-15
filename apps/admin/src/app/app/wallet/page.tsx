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
        <h1 className="student-title">Wallet</h1>
        <p className="student-muted">Loading wallet…</p>
      </div>
    );
  }

  const remaining =
    Number(account.credit_limit) - Number(account.outstanding_balance);

  return (
    <div>
      <h1 className="student-title">Wallet</h1>
      <p className="student-muted">COD only · no online payments</p>
      <div className="student-card">
        <div>Credit left: <strong>{formatInr(remaining)}</strong></div>
        <div>Outstanding: <strong>{formatInr(Number(account.outstanding_balance))}</strong></div>
        <div>Wallet credit: <strong>{formatInr(Number(account.wallet_credit))}</strong></div>
        <div className="student-muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Limit {formatInr(Number(account.credit_limit))}
        </div>
      </div>
      <h2 style={{ fontSize: 16 }}>Ledger</h2>
      {!ledger.length && <p className="student-muted">No entries yet.</p>}
      {ledger.map((l) => (
        <div key={l.id} className="student-card">
          <div className="student-row">
            <span className="student-badge">{l.entry_type}</span>
            <strong>{formatInr(Number(l.amount))}</strong>
          </div>
          <div className="student-muted" style={{ marginBottom: 0 }}>
            {l.note || "—"} · {new Date(l.created_at).toLocaleString("en-IN")}
          </div>
        </div>
      ))}
    </div>
  );
}
