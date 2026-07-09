import { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import {
  useAiTargets,
  useConnectionNotes,
  useFindPeople,
  useSuggestReferrals,
} from "@/hooks/useReferralAi";
import { colors } from "@/constants/theme";

export default function ReferralFinder() {
  const params = useLocalSearchParams<{ company?: string; role?: string }>();
  const [company, setCompany] = useState(params.company ?? "");
  const [role, setRole] = useState(params.role ?? "");
  const [err, setErr] = useState<string | null>(null);

  const suggest = useSuggestReferrals();
  const targets = useAiTargets();
  const notes = useConnectionNotes();
  const people = useFindPeople();

  function guard(): boolean {
    setErr(null);
    if (!company.trim()) {
      setErr("Company is required");
      return false;
    }
    return true;
  }
  const args = () => ({ company: company.trim(), role: role.trim() });

  const busy = suggest.isPending || targets.isPending || notes.isPending || people.isPending;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Referral finder" subtitle="Find the right people to ask" back />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        <View className="gap-2">
          <Input label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Stripe" />
          <Input label="Role" value={role} onChangeText={setRole} placeholder="e.g. Platform Engineer" />
          {err ? <Text className="text-xs text-bad">{err}</Text> : null}
        </View>

        <View className="flex-row flex-wrap gap-2">
          <View className="flex-1"><Button label="Suggest personas" onPress={() => guard() && suggest.mutate(args())} loading={suggest.isPending} /></View>
          <View className="flex-1"><Button label="AI targets" variant="secondary" onPress={() => guard() && targets.mutate(args())} loading={targets.isPending} /></View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <View className="flex-1"><Button label="Connection notes" variant="secondary" onPress={() => guard() && notes.mutate(args())} loading={notes.isPending} /></View>
          <View className="flex-1"><Button label="Find people (LinkedIn)" variant="ghost" onPress={() => guard() && people.mutate(args())} loading={people.isPending} /></View>
        </View>

        {busy ? <ActivityIndicator color={colors.brand} /> : null}
        {(suggest.error || targets.error || notes.error || people.error) ? (
          <Text className="text-sm text-bad">
            {(suggest.error || targets.error || notes.error || people.error) instanceof Error
              ? (suggest.error || targets.error || notes.error || people.error as Error).message
              : "Request failed"}
          </Text>
        ) : null}

        {/* Rule-based personas */}
        {suggest.data ? (
          <View className="gap-3">
            <Text className="text-sm text-muted">{suggest.data.pitchLine}</Text>
            {suggest.data.suggestions.map((s) => (
              <Card key={s.persona}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-paper">{s.personaLabel}</Text>
                  <Text className="text-xs font-bold text-brand">{s.score}/100</Text>
                </View>
                <Text className="mt-1 text-xs text-good">{s.recommendedAskLabel}</Text>
                {s.reasons?.slice(0, 2).map((r, i) => (
                  <Text key={i} className="mt-1 text-xs text-muted">• {r}</Text>
                ))}
                {s.linkedinUrl ? (
                  <Text className="mt-2 text-xs font-medium text-brand" onPress={() => Linking.openURL(s.linkedinUrl)}>
                    🔗 Open LinkedIn search
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}

        {/* AI targets */}
        {targets.data ? (
          <View className="gap-3">
            {targets.data.strategy ? (
              <Card><Text className="text-sm text-muted">{targets.data.strategy}</Text></Card>
            ) : null}
            {targets.data.targets.length === 0 ? (
              <Text className="text-xs text-muted">No AI targets yet — tap again to generate.</Text>
            ) : (
              targets.data.targets.map((t, i) => (
                <Card key={i}>
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-base font-semibold text-paper">{t.persona || "Target"}</Text>
                    {t.warmth ? (
                      <View className="rounded-md bg-bg-elevated px-2 py-0.5">
                        <Text className="text-[10px] text-good">{t.warmth} warmth</Text>
                      </View>
                    ) : null}
                  </View>
                  {t.who ? <Text className="mt-1 text-sm text-muted">{t.who}</Text> : null}
                  {t.why ? <Text className="mt-1 text-xs text-muted">{t.why}</Text> : null}
                  {t.outreachMessage ? (
                    <View className="mt-2 rounded-lg bg-bg p-2">
                      <Text className="text-xs text-paper">{t.outreachMessage}</Text>
                    </View>
                  ) : null}
                  {t.linkedinUrl ? (
                    <Text className="mt-2 text-xs font-medium text-brand" onPress={() => Linking.openURL(String(t.linkedinUrl))}>
                      🔗 LinkedIn search
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : null}

        {/* Connection notes */}
        {notes.data ? (
          <Card>
            <Text className="mb-2 text-sm font-semibold text-paper">Connection notes</Text>
            {notes.data.directAsk ? <NoteBlock label="Direct ask" text={notes.data.directAsk} /> : null}
            {notes.data.warmIntro ? <NoteBlock label="Warm intro" text={notes.data.warmIntro} /> : null}
            {notes.data.referralFollowUp ? <NoteBlock label="Follow-up DM" text={notes.data.referralFollowUp} /> : null}
          </Card>
        ) : null}

        {/* Found people */}
        {people.data ? (
          <View className="gap-3">
            {people.data.people.length === 0 ? (
              <Text className="text-xs text-muted">No people found.</Text>
            ) : (
              people.data.people.map((p, i) => (
                <Card key={i}>
                  <Text className="text-base font-semibold text-paper">{p.name || "—"}</Text>
                  {p.headline ? <Text className="text-xs text-muted">{p.headline}</Text> : null}
                  {(p.linkedinUrl || p.profileUrl) ? (
                    <Text className="mt-2 text-xs font-medium text-brand" onPress={() => Linking.openURL(String(p.linkedinUrl || p.profileUrl))}>
                      🔗 Open profile
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoteBlock({ label, text }: { label: string; text: string }) {
  return (
    <View className="mb-2">
      <Text className="text-xs font-medium text-brand">{label}</Text>
      <Text className="text-sm text-paper">{text}</Text>
    </View>
  );
}
