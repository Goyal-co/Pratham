import { useCallback, useEffect, useState } from "react";
import { Alert, Share, ScrollView, Text } from "react-native";
import { formatInr, type Referral } from "@pratham/shared";
import { Button, Card, Loader, Muted, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function ReferralsScreen() {
  const { profile } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [x, setX] = useState(5);
  const [y, setY] = useState(100);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [refs, settings] = await Promise.all([
      api<{ referrals: Referral[] }>("/referrals"),
      api<{
        settings: {
          referral_min_completed_orders: number;
          referral_reward_credits: number;
        };
      }>("/settings"),
    ]);
    setReferrals(refs.referrals ?? []);
    if (settings.settings) {
      setX(settings.settings.referral_min_completed_orders);
      setY(Number(settings.settings.referral_reward_credits));
    }
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
    >
      <Title>Invite friends</Title>
      <Muted>
        When they complete {x} delivered orders, you earn {formatInr(y)} wallet
        credit (set by admin).
      </Muted>
      <Card>
        <Text style={{ color: colors.muted, fontWeight: "600" }}>Your code</Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            letterSpacing: 2,
            marginVertical: 8,
          }}
        >
          {profile?.referral_code}
        </Text>
        <Button
          title="Share invite"
          onPress={async () => {
            try {
              await Share.share({
                message: `Join Rotatinal (breakfast / lunch / dinner) with my code ${profile?.referral_code}. After you complete ${x} orders, I get ${formatInr(y)} wallet credit!`,
              });
            } catch {
              Alert.alert("Share failed");
            }
          }}
        />
      </Card>
      {referrals.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: "800", textTransform: "capitalize" }}>
            {r.status}
          </Text>
          <Muted>
            Progress {r.completed_orders}/{x} delivered orders
          </Muted>
          {r.status === "pending" && (
            <Text style={{ fontWeight: "700", color: colors.warn }}>
              {Math.max(0, x - r.completed_orders)} more orders for reward
            </Text>
          )}
        </Card>
      ))}
      {!referrals.length && <Muted>No invites claimed yet.</Muted>}
    </ScrollView>
  );
}
