import { TextInput, View, Text } from "react-native";
import type { TextInputProps } from "react-native";
import { colors } from "@/constants/theme";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: Props) {
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium text-muted">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        className={`rounded-xl border bg-bg-card px-4 py-3 text-base text-white ${error ? "border-bad" : "border-border"}`}
        {...props}
      />
      {error ? <Text className="text-xs text-bad">{error}</Text> : null}
    </View>
  );
}
