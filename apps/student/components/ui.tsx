import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors } from "@/lib/theme";

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
}: {
  children?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, styles.screenContent, contentStyle, style]}>
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "danger" && styles.btnDanger,
        (disabled || pressed) && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === "secondary" && { color: colors.ink },
          variant === "danger" && { color: colors.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  muted: {
    color: colors.muted,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnDanger: {
    backgroundColor: "#FFF0EF",
  },
  btnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  label: {
    marginBottom: 6,
    color: colors.muted,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 48,
    fontSize: 16,
    color: colors.ink,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
