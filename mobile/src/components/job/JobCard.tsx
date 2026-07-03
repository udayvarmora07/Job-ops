import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import type { Job } from "@/types";
import { relativeDate } from "@/utils/format";

interface Props {
  job: Job;
  onPress?: () => void;
}

export function JobCard({ job, onPress }: Props) {
  return (
    <Card onPress={onPress}>
      <View className="gap-1">
        <Text className="text-base font-semibold text-white" numberOfLines={2}>
          {job.role}
        </Text>
        <Text className="text-sm text-muted">
          {job.company}
          {job.location ? ` • ${job.location}` : ""}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Badge label={job.portal} />
            {job.inPipeline ? <Badge label="In pipeline" tone="info" /> : null}
            {job.processed ? <Badge label="Evaluated" tone="good" /> : null}
          </View>
          <Text className="text-xs text-muted">{relativeDate(job.firstSeen)}</Text>
        </View>
      </View>
    </Card>
  );
}

function Badge({ label, tone = "muted" }: { label: string; tone?: "muted" | "info" | "good" }) {
  const cls =
    tone === "info"
      ? "text-info"
      : tone === "good"
        ? "text-good"
        : "text-muted";
  return (
    <View className="rounded-md bg-bg-elevated px-2 py-0.5">
      <Text className={`text-[10px] font-medium ${cls}`}>{label}</Text>
    </View>
  );
}
