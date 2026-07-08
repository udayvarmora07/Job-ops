import { Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Show a back button (for stack screens). */
  back?: boolean;
}

export function ScreenHeader({ title, subtitle, right, back }: Props) {
  const router = useRouter();
  return (
    <View className="gap-2 px-4 pb-3 pt-2">
      {back ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        >
          <Text className="text-base text-brand">← Back</Text>
        </Pressable>
      ) : null}
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-white">{title}</Text>
          {subtitle ? <Text className="text-sm text-muted">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}
