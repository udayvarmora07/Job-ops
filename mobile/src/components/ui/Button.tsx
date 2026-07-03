import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

const containerFor: Record<Variant, string> = {
  primary: "bg-brand",
  secondary: "bg-bg-elevated",
  ghost: "bg-transparent border border-border",
  danger: "bg-bad",
};

const textFor: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  ghost: "text-muted",
  danger: "text-white",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl px-4 py-3 ${containerFor[variant]} ${isDisabled ? "opacity-50" : "active:opacity-80"}`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`text-base font-semibold ${textFor[variant]}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
