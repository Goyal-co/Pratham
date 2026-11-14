import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text } from "react-native";
import type { NotificationRow } from "@pratham/shared";
import { Card, Loader, Muted, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function NotificationsScreen() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ notifications: NotificationRow[] }>("/notifications");
    setRows(data.notifications ?? []);
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
      <Title>Alerts</Title>
      <Muted>Order updates, balance, and referral rewards.</Muted>
      {rows.map((n) => (
        <Pressable
          key={n.id}
          onPress={async () => {
            await api("/notifications", { method: "PATCH", json: { id: n.id } });
            await load();
          }}
        >
          <Card
            style={{
              opacity: n.read_at ? 0.65 : 1,
              borderColor: n.read_at ? colors.line : colors.accent,
            }}
          >
            <Text style={{ fontWeight: "800" }}>{n.title}</Text>
            <Muted>{n.body}</Muted>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {new Date(n.created_at).toLocaleString("en-IN")}
            </Text>
          </Card>
        </Pressable>
      ))}
      {!rows.length && <Muted>No notifications yet.</Muted>}
    </ScrollView>
  );
}
