import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button, Field, Screen, Title, Muted } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Login failed", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={{ justifyContent: "center", flexGrow: 1 }}>
      <Title>Ahariva</Title>
      <Muted>Student meals · cash on delivery</Muted>
      <Field
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={busy ? "Signing in…" : "Sign in"} onPress={onLogin} disabled={busy} />
      <View style={{ height: 14 }} />
      <Link href="/(auth)/signup" asChild>
        <Text style={{ color: colors.accent, fontWeight: "700", textAlign: "center" }}>
          New here? Create account
        </Text>
      </Link>
    </Screen>
  );
}
