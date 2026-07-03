import { Text, View } from "react-native";

interface Props {
  value: number | string;
  label: string;
  accent?: string;
}

export function StatCard({ value, label, accent = "#F9FAFB" }: Props) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-bg-card border border-border py-4">
      <Text className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </Text>
      <Text className="mt-1 text-xs text-muted">{label}</Text>
    </View>
  );
}
