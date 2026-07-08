import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useScan } from "@/hooks/useActions";
import { colors } from "@/constants/theme";
import type { ScanResult } from "@/types";

export default function Scan() {
  const router = useRouter();
  const scan = useScan();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onScan() {
    setError(null);
    setResult(null);
    try {
      setResult(await scan.mutateAsync());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Scan portals" subtitle="Find new job postings" back />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        <Text className="text-sm text-muted">
          Scans your configured job portals (Greenhouse / Ashby / Lever) for new
          postings and adds them to the pipeline. This can take a minute.
        </Text>

        <Button
          label={scan.isPending ? "Scanning…" : "Start scan"}
          onPress={onScan}
          loading={scan.isPending}
        />

        {scan.isPending ? (
          <View className="items-center gap-2 py-6">
            <ActivityIndicator color={colors.brand} />
            <Text className="text-xs text-muted">Hitting portal APIs… hang tight.</Text>
          </View>
        ) : null}

        {error ? <Text className="text-sm text-bad">{error}</Text> : null}

        {result ? (
          <Card>
            <Text className="text-base font-semibold text-white">
              {result.ok ? "✅ Scan complete" : "⚠️ Scan finished with issues"}
            </Text>
            <Text className="mt-1 text-sm text-muted">{result.summary}</Text>
            {result.sources.length ? (
              <View className="mt-3 gap-1">
                {result.sources.map((s) => (
                  <View key={s.id} className="flex-row justify-between">
                    <Text className="text-xs text-muted">{s.label ?? s.id}</Text>
                    <Text className="text-xs text-white">
                      {s.new == null ? "—" : `${s.new} new`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="mt-3">
              <Button label="View jobs" variant="secondary" onPress={() => router.push("/(tabs)/jobs")} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
