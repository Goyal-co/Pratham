import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { formatInr, type Order } from "@pratham/shared";
import { Card, Loader, Muted, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ orders: Order[] }>("/orders");
    setOrders(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader />;

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
      <Title>Your orders</Title>
      <Muted>Multiple meals and quantities are tracked here.</Muted>
      {orders.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: "800", textTransform: "capitalize" }}>
            {o.meal_type} ×{o.quantity}
          </Text>
          <Muted>
            {o.order_date} · {String(o.source).replace("_", " ")} ·{" "}
            {String(o.status).replaceAll("_", " ")}
          </Muted>
          <Text style={{ fontWeight: "700" }}>
            COD {formatInr(Number(o.payable_amount))}
            {Number(o.wallet_applied) > 0
              ? ` · wallet −${formatInr(Number(o.wallet_applied))}`
              : ""}
          </Text>
        </Card>
      ))}
      {!orders.length && <Muted>No orders yet.</Muted>}
    </ScrollView>
  );
}
