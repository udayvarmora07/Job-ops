import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useApplications, useUpdateStatus } from "@/hooks/useApplications";
import { Card } from "@/components/ui/Card";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Confetti } from "@/components/ui/Confetti";
import { APPLICATION_STATUSES } from "@/types";
import { relativeDate } from "@/utils/format";
import { colors, statusColor } from "@/constants/theme";

export default function ApplicationDetail() {
  const { num } = useLocalSearchParams<{ num: string }>();
  const { data } = useApplications();
  const update = useUpdateStatus();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);

  const app = (data ?? []).find((a) => a.num === num);

  if (!app) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScreenHeader title={`Application #${num}`} back />
        <Text className="px-4 text-sm text-muted">Application not found.</Text>
      </SafeAreaView>
    );
  }

  async function setStatus(status: string) {
    setSavedMsg(null);
    try {
      await update.mutateAsync({ num: String(app!.num), status });
      setSavedMsg(`Status updated to ${status}`);
      if (status === "Interview") setConfetti((n) => n + 1);
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title={`Application #${app.num}`} back />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        <Card>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-lg font-bold text-paper">{app.role}</Text>
              <Text className="text-sm text-muted">{app.company}</Text>
              <View className="mt-1 flex-row items-center gap-2">
                <StatusBadge status={String(app.status)} />
                <Text className="text-xs text-muted">• {relativeDate(app.date)}</Text>
              </View>
            </View>
            <ScoreBadge score={app.scoreNum} />
          </View>
          {app.notes ? <Text className="mt-3 text-sm text-muted">{app.notes}</Text> : null}
        </Card>

        <Card>
          <Text className="mb-3 text-sm font-semibold text-paper">Update status</Text>
          <View className="flex-row flex-wrap gap-2">
            {APPLICATION_STATUSES.map((s) => {
              const active = app.status === s;
              const color = statusColor(s);
              return (
                <Pressable
                  key={s}
                  testID={`status-${s}`}
                  onPress={() => setStatus(s)}
                  disabled={update.isPending}
                  className="rounded-full px-3 py-1.5"
                  style={{ backgroundColor: active ? color : colors.elevated }}
                >
                  <Text className="text-sm" style={{ color: active ? colors.bg : color }}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {savedMsg ? <Text className="mt-3 text-xs text-good">{savedMsg}</Text> : null}
        </Card>
      </ScrollView>
      <Confetti trigger={confetti} />
    </SafeAreaView>
  );
}
