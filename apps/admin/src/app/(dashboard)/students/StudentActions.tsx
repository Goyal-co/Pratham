"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/http";

export function StudentActions({
  studentId,
  creditLimit,
  wallet,
}: {
  studentId: string;
  creditLimit: number;
  wallet: number;
  /** @deprecated ignored — wallet is the balance */
  outstanding?: number;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(String(creditLimit));
  const debt = Math.max(0, -wallet);
  const [collectAmount, setCollectAmount] = useState(
    debt > 0 ? String(debt) : ""
  );
  const [busy, setBusy] = useState(false);

  async function saveLimit() {
    setBusy(true);
    try {
      await api(`/api/students/${studentId}/credit-limit`, {
        method: "PATCH",
        json: { credit_limit: Number(limit) },
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function collectCash() {
    const amount = Number(collectAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter cash amount collected");
      return;
    }
    const note =
      prompt("Collection note (optional)", "Cash collected") ?? undefined;
    setBusy(true);
    try {
      const data = await api<{
        amount_paid: number;
        account: { wallet_credit: number };
      }>(`/api/students/${studentId}/collect`, {
        method: "POST",
        json: { amount_paid: amount, note },
      });
      alert(
        `Collected ₹${data.amount_paid}.\nWallet now ₹${Number(data.account.wallet_credit).toFixed(0)}`
      );
      setCollectAmount("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 200 }}>
      <div className="row">
        <input
          style={{ width: 90 }}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          aria-label="Credit limit"
        />
        <button className="btn secondary" disabled={busy} onClick={saveLimit}>
          Set limit
        </button>
      </div>
      <div className="row">
        <input
          style={{ width: 90 }}
          type="number"
          min={0}
          step={1}
          placeholder="Cash ₹"
          value={collectAmount}
          onChange={(e) => setCollectAmount(e.target.value)}
          aria-label="Cash collected"
        />
        <button className="btn" disabled={busy} onClick={collectCash}>
          Collect
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 11 }}>
        Cash always adds to wallet (clears debt first).
      </p>
    </div>
  );
}
