import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  formatCountdown,
  formatInr,
  getOpenMeals,
  getZonedParts,
  isMealOpen,
  minutesUntilCutoff,
  type MealType,
  type MenuItem,
} from "@pratham/shared";
import { Button, Card, Loader, Muted, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";

type Cutoffs = Record<MealType, string>;

type SuccessInfo = {
  name: string;
  quantity: number;
  payable: number;
  remaining: number;
};

export default function HomeScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cutoffs, setCutoffs] = useState<Cutoffs>(DEFAULT_CUTOFFS);
  const [account, setAccount] = useState({
    credit_limit: 0,
    outstanding_balance: 0,
    wallet_credit: 0,
  });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const load = useCallback(async () => {
    const today = getZonedParts().dateStr;
    const [menu, settings, acct] = await Promise.all([
      api<{ items: MenuItem[] }>(`/menu?date=${today}`),
      api<{ settings: Record<string, string | number> }>("/settings"),
      api<{ account: typeof account }>("/account"),
    ]);
    setItems(menu.items ?? []);
    if (settings.settings) {
      setCutoffs({
        breakfast: String(settings.settings.breakfast_cutoff),
        lunch: String(settings.settings.lunch_cutoff),
        dinner: String(settings.settings.dinner_cutoff),
      });
    }
    if (acct.account) {
      setAccount({
        credit_limit: Number(acct.account.credit_limit),
        outstanding_balance: Number(acct.account.outstanding_balance),
        wallet_credit: Number(acct.account.wallet_credit),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => Alert.alert("Load failed", e.message));
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [load]);

  const { dateStr } = useMemo(() => getZonedParts(now), [now]);
  const openMeals = useMemo(() => getOpenMeals(cutoffs, now), [cutoffs, now]);
  const nextHint = useMemo(() => {
    if (openMeals.length) {
      const m = openMeals[0];
      return `${MEAL_LABELS[m]} open · ${formatCountdown(minutesUntilCutoff(m, cutoffs, now))}`;
    }
    return "All meals closed for today — see you tomorrow";
  }, [openMeals, cutoffs, now]);

  async function placeOrder(item: MenuItem) {
    const quantity = qty[item.id] ?? 1;
    if (!isMealOpen(item.meal_type, cutoffs, now)) {
      return Alert.alert("Closed", `${MEAL_LABELS[item.meal_type]} ordering is closed.`);
    }
    try {
      const data = await api<{
        order: { payable_amount: number; wallet_applied: number };
      }>("/orders", {
        method: "POST",
        json: {
          meal_type: item.meal_type,
          menu_item_id: item.id,
          quantity,
          order_date: dateStr,
        },
      });
      await load();
      const payable = Number(data.order.payable_amount);
      const remainingAfter =
        Number(account.credit_limit) -
        (Number(account.outstanding_balance) + payable);
      setSuccess({
        name: item.name,
        quantity,
        payable,
        remaining: Math.max(0, remainingAfter),
      });
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      Alert.alert("Order failed", e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <Loader />;

  const remaining = account.credit_limit - account.outstanding_balance;
  const blocked = account.outstanding_balance >= account.credit_limit;

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
      <Title>Hi {profile?.full_name?.split(" ")[0] ?? "there"}</Title>
      <Muted>
        Today {dateStr} · Credit left {formatInr(remaining)} · Wallet{" "}
        {formatInr(account.wallet_credit)}
      </Muted>
      <Muted>{nextHint}</Muted>

      {blocked ? (
        <Card style={styles.bannerDanger}>
          <Text style={styles.bannerTitle}>Credit limit reached</Text>
          <Text style={styles.bannerBody}>
            Clear dues with the kitchen (cash). Admin will reset your outstanding
            balance so you can order again.
          </Text>
        </Card>
      ) : null}

      {success ? (
        <Card style={styles.bannerOk}>
          <Text style={styles.bannerTitle}>Order placed</Text>
          <Text style={styles.bannerBody}>
            {success.name} ×{success.quantity} · COD {formatInr(success.payable)}
            {"\n"}
            Remaining credit ≈ {formatInr(success.remaining)}
          </Text>
          <Pressable onPress={() => setSuccess(null)}>
            <Text style={{ color: colors.accentDark, fontWeight: "700", marginTop: 8 }}>
              Dismiss
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
        const open = isMealOpen(meal, cutoffs, now);
        const mins = minutesUntilCutoff(meal, cutoffs, now);
        const mealItems = items.filter((i) => i.meal_type === meal);
        return (
          <View key={meal} style={{ marginBottom: 8 }}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealTitle}>{MEAL_LABELS[meal]}</Text>
              <Text
                style={{
                  color: open ? colors.ok : colors.danger,
                  fontWeight: "700",
                }}
              >
                {open ? formatCountdown(mins) : "Closed"}
              </Text>
            </View>
            {!open ? (
              <Card>
                <Muted>
                  {MEAL_LABELS[meal]} closed at {cutoffs[meal]} IST.{" "}
                  {openMeals.length
                    ? `Next open: ${MEAL_LABELS[openMeals[0]]}`
                    : "Come back tomorrow."}
                </Muted>
              </Card>
            ) : null}
            {mealItems.map((item) => (
              <Card key={item.id} style={!open ? { opacity: 0.55 } : undefined}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Muted>{item.description}</Muted>
                <Text style={styles.price}>{formatInr(Number(item.price))} · COD</Text>
                <View style={styles.qtyRow}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() =>
                      setQty((q) => ({
                        ...q,
                        [item.id]: Math.max(1, (q[item.id] ?? 1) - 1),
                      }))
                    }
                  >
                    <Text style={styles.qtyText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{qty[item.id] ?? 1}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() =>
                      setQty((q) => ({
                        ...q,
                        [item.id]: Math.min(10, (q[item.id] ?? 1) + 1),
                      }))
                    }
                  >
                    <Text style={styles.qtyText}>+</Text>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Button
                    title="Order"
                    onPress={() => placeOrder(item)}
                    disabled={!open || blocked}
                  />
                </View>
              </Card>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  mealTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  itemName: { fontSize: 16, fontWeight: "700", color: colors.ink },
  price: { fontWeight: "700", color: colors.accentDark, marginBottom: 10 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  qtyText: { fontSize: 18, fontWeight: "700" },
  qtyValue: { minWidth: 24, textAlign: "center", fontWeight: "800" },
  bannerDanger: {
    backgroundColor: "#FFF0EF",
    borderColor: "#F5C2C0",
  },
  bannerOk: {
    backgroundColor: colors.accentSoft,
    borderColor: "#F2C49E",
  },
  bannerTitle: { fontWeight: "800", color: colors.ink, marginBottom: 4 },
  bannerBody: { color: colors.muted, lineHeight: 20 },
});
