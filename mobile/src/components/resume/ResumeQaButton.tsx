import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useResumeQa } from "@/hooks/useActions";
import { colors } from "@/constants/theme";
import type { ResumeQa } from "@/types";

/** Inline "QA Review" trigger + result for a résumé's latest PDF. */
export function ResumeQaButton({ file }: { file: string }) {
  const qa = useResumeQa();
  const [result, setResult] = useState<ResumeQa | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      setResult(await qa.mutateAsync(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "QA failed");
    }
  }

  const score = result?.ats?.score ?? result?.score ?? null;
  const scoreColor = score == null ? colors.muted : score >= 75 ? colors.good : score >= 50 ? colors.warn : colors.bad;

  return (
    <View className="mt-2 border-t border-border pt-2">
      {qa.isPending ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={colors.brand} />
          <Text className="text-xs text-muted">Running ATS review…</Text>
        </View>
      ) : result ? (
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-semibold" style={{ color: scoreColor }}>
              ATS {score ?? "—"}/100
            </Text>
            {result.verdict ? <Text className="text-xs text-muted">• {result.verdict}</Text> : null}
          </View>
          {result.summary ? (
            <Text className="text-xs text-muted" numberOfLines={4}>
              {result.summary}
            </Text>
          ) : null}
          {result.ats?.missing?.length ? (
            <Text className="text-xs text-warn" numberOfLines={2}>
              Missing keywords: {result.ats.missing.slice(0, 8).join(", ")}
            </Text>
          ) : null}
        </View>
      ) : error ? (
        <Text className="text-xs text-bad">{error}</Text>
      ) : (
        <Text className="text-xs font-medium text-brand" onPress={run} accessibilityRole="button">
          🔍 QA Review (ATS)
        </Text>
      )}
    </View>
  );
}
