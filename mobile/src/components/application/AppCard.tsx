import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Application } from "@/types";
import { relativeDate } from "@/utils/format";

interface Props {
  application: Application;
  onPress?: () => void;
}

export function AppCard({ application, onPress }: Props) {
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-white" numberOfLines={2}>
            {application.role}
          </Text>
          <Text className="text-sm text-muted">{application.company}</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <StatusBadge status={String(application.status)} />
            <Text className="text-xs text-muted">{relativeDate(application.date)}</Text>
          </View>
        </View>
        <ScoreBadge score={application.scoreNum} />
      </View>
    </Card>
  );
}
