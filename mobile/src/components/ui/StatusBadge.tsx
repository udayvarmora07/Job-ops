import { Text, View } from "react-native";
import { statusColor } from "@/constants/theme";

export function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <View
      className="self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${color}22` }}
    >
      <Text className="text-xs font-semibold" style={{ color }}>
        {status}
      </Text>
    </View>
  );
}
