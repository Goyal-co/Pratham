import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Muted, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/lib/theme";

function NavRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={{ fontWeight: "700", color: colors.ink, fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <Title>Profile</Title>
      <Muted>Cash on delivery only — no online payments.</Muted>
      <Card>
        <Text style={{ fontWeight: "800", fontSize: 18, color: colors.ink }}>
          {profile?.full_name}
        </Text>
        <Muted>{profile?.phone}</Muted>
        <Muted>
          {profile?.hostel} {profile?.room}
        </Muted>
        <Text style={{ fontWeight: "700", marginTop: 8, color: colors.ink }}>
          Referral code: {profile?.referral_code}
        </Text>
      </Card>

      <Card>
        <NavRow
          label="Invite friends"
          onPress={() => router.push("/(tabs)/referrals")}
        />
        <NavRow
          label="Notifications"
          onPress={() => router.push("/(tabs)/notifications")}
        />
        <View style={{ height: 0 }} />
      </Card>

      <Button
        title="Sign out"
        variant="secondary"
        onPress={async () => {
          await signOut();
          Alert.alert("Signed out");
        }}
      />
    </Screen>
  );
}
