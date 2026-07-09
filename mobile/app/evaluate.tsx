import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useEvaluate, useFetchJd } from "@/hooks/useActions";
import { colors } from "@/constants/theme";
import type { EvaluateResult } from "@/types";

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

export default function Evaluate() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jd?: string; url?: string }>();
  const [input, setInput] = useState(params.jd ?? params.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluateResult | null>(null);

  const evaluate = useEvaluate();
  const fetchJd = useFetchJd();
  const busy = evaluate.isPending || fetchJd.isPending;

  async function onEvaluate() {
    setError(null);
    setResult(null);
    const text = input.trim();
    if (text.length < 20 && !isUrl(text)) {
      setError("Paste a job description (or a job URL).");
      return;
    }
    try {
      let jd = text;
      if (isUrl(text)) jd = await fetchJd.mutateAsync(text);
      const r = await evaluate.mutateAsync(jd);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Evaluate" subtitle="AI job-fit evaluation" back />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
          <Text className="text-sm text-muted">
            Paste a job description or a job URL (Greenhouse / Lever / Ashby). The AI
            scores fit and saves a full report to your tracker.
          </Text>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Paste JD text, or https://boards.greenhouse.io/…"
            placeholderTextColor={colors.muted}
            multiline
            editable={!busy}
            className="min-h-[160px] rounded-xl border border-border bg-bg-card p-4 text-base text-paper"
            style={{ textAlignVertical: "top" }}
          />

          {error ? <Text className="text-sm text-bad">{error}</Text> : null}

          <Button
            label={fetchJd.isPending ? "Fetching JD…" : evaluate.isPending ? "Evaluating…" : "Evaluate"}
            onPress={onEvaluate}
            loading={busy}
          />

          {busy ? (
            <View className="items-center gap-2 py-4">
              <ActivityIndicator color={colors.brand} />
              <Text className="text-xs text-muted">The AI is reading the JD — this can take 10–30s.</Text>
            </View>
          ) : null}

          {result ? (
            <Card>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-bold text-paper">{result.role}</Text>
                  <Text className="text-sm text-muted">{result.company}</Text>
                  <Text className="mt-1 text-xs text-good">✓ Saved as report #{result.num}</Text>
                </View>
                <ScoreBadge score={parseFloat(String(result.score))} />
              </View>
              <View className="mt-3">
                <Button
                  label="Read full report"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/report/[id]", params: { id: String(result.num) } })}
                />
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
