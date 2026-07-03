import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-4 bg-bg px-6">
        <Text className="text-4xl">🧭</Text>
        <Text className="text-lg font-semibold text-white">This screen doesn&apos;t exist.</Text>
        <Link href="/(tabs)" className="text-base text-brand">
          Go to home
        </Link>
      </View>
    </>
  );
}
