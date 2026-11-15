import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Button, Field, Screen, Title, Muted } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [hostel, setHostel] = useState("");
  const [room, setRoom] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSignup() {
    setBusy(true);
    try {
      await signUp({
        full_name: fullName,
        email: email.trim().toLowerCase(),
        password,
        phone,
        hostel,
        room,
        referral_code: referralCode.trim(),
      });
      Alert.alert("Welcome", "Account created. You can order now.");
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Signup failed", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Join Ahariva</Title>
      <Muted>Optional invite code unlocks referral rewards for your friend.</Muted>
      <Field label="Full name" value={fullName} onChangeText={setFullName} />
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
      <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Field label="Hostel" value={hostel} onChangeText={setHostel} />
      <Field label="Room" value={room} onChangeText={setRoom} />
      <Field
        label="Referral code (optional)"
        autoCapitalize="characters"
        value={referralCode}
        onChangeText={setReferralCode}
      />
      <Button
        title={busy ? "Creating…" : "Create account"}
        onPress={onSignup}
        disabled={busy}
      />
    </Screen>
  );
}
