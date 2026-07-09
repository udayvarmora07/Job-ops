import { ActivityIndicator, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useReports, useReportContent } from "@/hooks/useReports";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Markdown } from "@/components/ui/Markdown";
import { colors } from "@/constants/theme";

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reports } = useReports();
  const content = useReportContent(id);

  const meta = (reports ?? []).find((r) => r.id === id);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title={`Report #${id}`} back />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        {meta ? (
          <Card>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-lg font-bold text-paper">{meta.role}</Text>
                <Text className="text-sm text-muted">{meta.company}</Text>
                <View className="mt-1 flex-row flex-wrap items-center gap-2">
                  {meta.legitimacy ? <Tag text={meta.legitimacy} /> : null}
                  {meta.archetype ? <Tag text={meta.archetype} /> : null}
                  {meta.location ? <Tag text={meta.location} /> : null}
                </View>
              </View>
              <ScoreBadge score={meta.scoreNum} />
            </View>
            {meta.url ? (
              <View className="mt-3">
                <Button label="Open posting" variant="secondary" onPress={() => Linking.openURL(meta.url as string)} />
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          {content.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : content.isError ? (
            <Text className="text-sm text-bad">Couldn&apos;t load report content.</Text>
          ) : (
            <Markdown content={content.data ?? ""} />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View className="rounded-md bg-bg-elevated px-2 py-0.5">
      <Text className="text-[10px] font-medium text-muted">{text}</Text>
    </View>
  );
}
