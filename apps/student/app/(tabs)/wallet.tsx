import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { formatInr } from "@pratham/shared";
import { Card, Loader, Muted, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

type Ledger = {
  id: string;
  entry_type: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export default function WalletScreen() {
  const [account, setAccount] = useState({
    credit_limit: 0,
    outstanding_balance: 0,
    wallet_credit: 0,
  });
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ account: typeof account; ledger: Ledger[] }>("/account");
    if (data.account) setAccount(data.account);
    setLedger(data.ledger ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader />;
  const remaining = account.credit_limit - account.outstanding_balance;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Title>Wallet</Title>
      <Muted>Pay cash to kitchen. Admin clears outstanding after collection.</Muted>
      <Card>
        <Text style={{ fontWeight: "800", fontSize: 18 }}>
          Outstanding {formatInr(Number(account.outstanding_balance))}
        </Text>
        <Muted>
          Limit {formatInr(Number(account.credit_limit))} · Remaining{" "}
          {formatInr(remaining)}
        </Muted>
        <Text style={{ fontWeight: "700", color: colors.accent }}>
          Wallet credit {formatInr(Number(account.wallet_credit))}
        </Text>
      </Card>
      <Text style={{ fontWeight: "800", marginBottom: 8, color: colors.ink }}>
        Ledger
      </Text>
      {ledger.map((e) => (
        <Card key={e.id}>
          <Text style={{ fontWeight: "700", textTransform: "capitalize" }}>
            {e.entry_type.replaceAll("_", " ")}
          </Text>
          <Muted>{new Date(e.created_at).toLocaleString("en-IN")}</Muted>
          <Text style={{ fontWeight: "800" }}>{formatInr(Number(e.amount))}</Text>
          {e.note ? <Muted>{e.note}</Muted> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
