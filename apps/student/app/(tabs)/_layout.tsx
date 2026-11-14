import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

function TabIcon({
  label,
  glyph,
  focused,
}: {
  label: string;
  glyph: string;
  focused: boolean;
}) {
  return (
    <View style={{ alignItems: "center", minWidth: 56 }}>
      <Text style={{ fontSize: 16, marginBottom: 2 }}>{glyph}</Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? "800" : "600",
          color: focused ? colors.accent : colors.muted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === "ios" ? 8 : 6);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 56 + bottom,
          paddingBottom: bottom,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" glyph="⌂" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Orders" glyph="☰" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Plans" glyph="⟳" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Wallet" glyph="₹" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Me" glyph="☺" focused={focused} />
          ),
        }}
      />
      {/* Secondary screens reachable from Profile */}
      <Tabs.Screen
        name="referrals"
        options={{ href: null, title: "Invite" }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: "Alerts" }}
      />
    </Tabs>
  );
}
