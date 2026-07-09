import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Markdown } from "@/components/ui/Markdown";
import { useAiTask, useGenerateCoverPdf } from "@/hooks/useActions";
import { colors } from "@/constants/theme";

const TASKS = [
  { value: "cover_letter", label: "Cover letter", hint: "Paste the JD / brief" },
  { value: "interview_prep", label: "Interview prep", hint: "Company, role, stage, JD" },
  { value: "connection_notes", label: "Connection notes", hint: "Contact + context for a warm intro" },
] as const;

export default function AiStudio() {
  const [task, setTask] = useState<(typeof TASKS)[number]["value"]>("cover_letter");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useAiTask();
  const coverPdf = useGenerateCoverPdf();

  const current = TASKS.find((t) => t.value === task)!;

  async function onExportPdf() {
    if (!result) return;
    setError(null);
    try {
      await coverPdf.mutateAsync(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed");
    }
  }

  async function onRun() {
    setError(null);
    setResult(null);
    if (input.trim().length < 15) {
      setError("Add a bit more detail for the AI to work with.");
      return;
    }
    try {
      setResult(await run.mutateAsync({ task, input: input.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI task failed");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="AI Studio" subtitle="Cover letters, interview prep & more" back />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
          {/* Task picker */}
          <View className="flex-row flex-wrap gap-2">
            {TASKS.map((t) => {
              const active = t.value === task;
              return (
                <Pressable
                  key={t.value}
                  testID={`task-${t.value}`}
                  onPress={() => { setTask(t.value); setResult(null); setError(null); }}
                  className={`rounded-full px-3 py-1.5 ${active ? "bg-brand" : "bg-bg-elevated"}`}
                >
                  <Text className={`text-sm ${active ? "text-paper" : "text-muted"}`}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={current.hint + "…"}
            placeholderTextColor={colors.muted}
            multiline
            editable={!run.isPending}
            className="min-h-[150px] rounded-xl border border-border bg-bg-card p-4 text-base text-paper"
            style={{ textAlignVertical: "top" }}
          />

          {error ? <Text className="text-sm text-bad">{error}</Text> : null}

          <Button
            label={run.isPending ? "Generating…" : `Generate ${current.label.toLowerCase()}`}
            onPress={onRun}
            loading={run.isPending}
          />

          {run.isPending ? (
            <View className="items-center gap-2 py-4">
              <ActivityIndicator color={colors.brand} />
              <Text className="text-xs text-muted">The AI is writing — this can take 10–30s.</Text>
            </View>
          ) : null}

          {result ? (
            <>
              <Card>
                <Markdown content={result} />
              </Card>
              {task === "cover_letter" ? (
                <Button
                  label={coverPdf.isPending ? "Exporting…" : "Export as PDF"}
                  variant="secondary"
                  loading={coverPdf.isPending}
                  onPress={onExportPdf}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
