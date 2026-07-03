import { Text, View } from "react-native";
import { scoreColor } from "@/constants/theme";
import { formatScore } from "@/utils/format";

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const color = scoreColor(score);
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${color}22` }}
    >
      <Text className="text-xs font-bold" style={{ color }}>
        {formatScore(score)}
      </Text>
      <Text className="text-[10px]" style={{ color }}>
        / 5
      </Text>
    </View>
  );
}
