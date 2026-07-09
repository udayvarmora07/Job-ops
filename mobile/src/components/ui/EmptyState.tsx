import { Text, View } from "react-native";

interface Props {
  emoji?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ emoji = "📭", title, subtitle }: Props) {
  return (
    <View className="items-center justify-center gap-2 px-8 py-16">
      <Text className="text-4xl">{emoji}</Text>
      <Text className="text-center text-base font-semibold text-paper">{title}</Text>
      {subtitle ? (
        <Text className="text-center text-sm text-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
