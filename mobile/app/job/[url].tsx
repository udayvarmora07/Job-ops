import { useState } from "react";
import { Alert, Linking, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useJobs, useDeleteJob } from "@/hooks/useJobs";
import { useFetchJd, useGenerateCv } from "@/hooks/useActions";
import { hostFromUrl, relativeDate } from "@/utils/format";
import { colors } from "@/constants/theme";

export default function JobDetail() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url: string }>();
  const { data } = useJobs();
  const del = useDeleteJob();
  const fetchJd = useFetchJd();
  const genCv = useGenerateCv();
  const [note, setNote] = useState<string | null>(null);

  const job = (data ?? []).find((j) => j.url === url);

  function confirm(title: string, message: string, onYes: () => void) {
    if (Platform.OS === "web") {
      // RN Alert has no web impl; use window.confirm.
      // eslint-disable-next-line no-alert
      if (globalThis.confirm?.(message)) onYes();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onYes },
    ]);
  }

  async function onDelete() {
    if (!job) return;
    confirm("Delete job", `Remove "${job.role}" from the feed?`, async () => {
      try {
        await del.mutateAsync(job.url);
        router.back();
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  async function onEvaluate() {
    if (!job) return;
    setNote(null);
    // Prefill the Evaluate screen with the URL; it fetches the JD then evaluates.
    router.push({ pathname: "/evaluate", params: { url: job.url } });
  }

  async function onGenerateCv() {
    if (!job) return;
    setNote(null);
    try {
      const jd = await fetchJd.mutateAsync(job.url);
      const r = await genCv.mutateAsync({ jd, company: job.company, role: job.role, url: job.url });
      setNote(r.savedFilename ? `Résumé saved (v${r.savedVersion}) — see Resumes.` : "Résumé generated.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Résumé generation failed");
    }
  }

  const cvBusy = fetchJd.isPending || genCv.isPending;

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
            <Text className="text-base text-paper">Job not found in the current feed.</Text>
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
              <Text className="text-2xl font-bold text-paper">{job.role}</Text>
              <Text className="text-base text-muted">
                {job.company}
                {job.location ? ` • ${job.location}` : ""}
              </Text>
              <Text className="text-xs text-muted">
                {hostFromUrl(job.url)} • first seen {relativeDate(job.firstSeen)}
              </Text>
            </View>

            <Card>
              <Text className="mb-2 text-sm font-semibold text-paper">Status</Text>
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
              <Button label="🤖 Evaluate this job" onPress={onEvaluate} />
              <Button
                label={cvBusy ? "Generating résumé…" : "📄 Generate tailored résumé"}
                variant="secondary"
                onPress={onGenerateCv}
                loading={cvBusy}
              />
              <Button label="Apply / open posting" variant="secondary" onPress={() => Linking.openURL(job.url)} />
              <Button label="Delete job" variant="danger" onPress={onDelete} loading={del.isPending} />
            </View>

            {note ? <Text className="text-center text-sm text-good">{note}</Text> : null}
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
