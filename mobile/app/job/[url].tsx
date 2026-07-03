import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useJobs } from "@/hooks/useJobs";
import { hostFromUrl, relativeDate } from "@/utils/format";
import { colors } from "@/constants/theme";

export default function JobDetail() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url: string }>();
  const { data } = useJobs();

  const job = (data ?? []).find((j) => j.url === url);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-3 px-4 py-2">
        <Text onPress={() => router.back()} className="text-base text-brand">
          ← Back
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        {!job ? (
          <Card>
            <Text className="text-base text-white">Job not found in the current feed.</Text>
            <Text className="mt-1 text-sm text-muted">
              It may have been removed. You can still open the link below.
            </Text>
            {url ? (
              <View className="mt-4">
                <Button label="Open posting" onPress={() => Linking.openURL(url)} />
              </View>
            ) : null}
          </Card>
        ) : (
          <>
            <View className="gap-1 pt-2">
              <Text className="text-2xl font-bold text-white">{job.role}</Text>
              <Text className="text-base text-muted">
                {job.company}
                {job.location ? ` • ${job.location}` : ""}
              </Text>
              <Text className="text-xs text-muted">
                {hostFromUrl(job.url)} • first seen {relativeDate(job.firstSeen)}
              </Text>
            </View>

            <Card>
              <Text className="mb-2 text-sm font-semibold text-white">Status</Text>
              <Row label="Portal" value={job.portal} />
              <Row label="In pipeline" value={job.inPipeline ? "Yes" : "No"} />
              <Row
                label="Evaluated"
                value={job.processed ? "Yes" : "No"}
                valueColor={job.processed ? colors.good : colors.muted}
              />
              {job.expRequired ? <Row label="Experience" value={job.expRequired} /> : null}
            </Card>

            <View className="gap-3">
              <Button label="Apply / open posting" onPress={() => Linking.openURL(job.url)} />
              <Button
                label="Share"
                variant="secondary"
                onPress={() => Linking.openURL(job.url)}
              />
            </View>

            <Text className="text-center text-xs text-muted">
              AI evaluation and tailored CV generation arrive in Phase 2.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  valueColor = "#F9FAFB",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm" style={{ color: valueColor }}>
        {value}
      </Text>
    </View>
  );
}
