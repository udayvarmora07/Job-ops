import { Text, View } from "react-native";
import { useDemoStore } from "@/store/demo";

/**
 * Honest indicator shown when the app is displaying bundled demo data because
 * the backend was unreachable. Renders nothing when live data is in use.
 */
export function DemoBanner() {
  const active = useDemoStore((s) => s.active);
  if (!active) return null;
  return (
    <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-lg bg-warn/15 px-3 py-2">
      <Text className="text-xs">🔌</Text>
      <Text className="flex-1 text-xs text-warn">
        Demo data — backend offline. Set the API URL to see live data.
      </Text>
    </View>
  );
}
