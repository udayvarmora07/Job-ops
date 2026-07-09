import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAddApplication, useApplications } from "@/hooks/useApplications";
import { AppCard } from "@/components/application/AppCard";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { SectionLabel } from "@/components/ui/Meridian";
import { colors } from "@/constants/theme";
import type { Application } from "@/types";

const DAY = 86_400_000;
function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

interface Group {
  key: string;
  label: string;
  dot: string;
  items: Application[];
}

export default function Track() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useApplications();
  const add = useAddApplication();
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onAdd() {
    setErr(null);
    if (!company.trim()) {
      setErr("Company is required");
      return;
    }
    try {
      await add.mutateAsync({ company: company.trim(), role: role.trim(), status: "Applied" });
      setCompany("");
      setRole("");
      setShowForm(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    }
  }

  const apps = data ?? [];

  const stats = useMemo(() => {
    const by = (st: string) => apps.filter((a) => a.status === st).length;
    return [
      { n: by("Evaluated"), l: "To evaluate", c: colors.text },
      { n: by("Applied"), l: "Applied", c: colors.brand },
      { n: by("Interview"), l: "Interview", c: colors.good },
      { n: by("Offer"), l: "Offers", c: colors.good },
    ];
  }, [apps]);

  const groups = useMemo<Group[]>(() => {
    const needsAction: Application[] = [];
    const interview: Application[] = [];
    const applied: Application[] = [];
    const toEvaluate: Application[] = [];
    const closed: Application[] = [];

    for (const a of apps) {
      if (a.status === "Responded") needsAction.push(a);
      else if (a.status === "Applied") {
        const d = daysSince(a.date);
        if (d != null && d >= 5) needsAction.push(a);
        else applied.push(a);
      } else if (a.status === "Interview" || a.status === "Offer") interview.push(a);
      else if (a.status === "Evaluated") toEvaluate.push(a);
      else closed.push(a);
    }

    return [
      { key: "need", label: "Needs action", dot: colors.bad, items: needsAction },
      { key: "interview", label: "Interview & offers", dot: colors.good, items: interview },
      { key: "applied", label: "Applied", dot: colors.brand, items: applied },
      { key: "eval", label: "To evaluate", dot: colors.muted, items: toEvaluate },
      { key: "closed", label: "Closed", dot: colors.subtle, items: closed },
    ].filter((g) => g.items.length > 0);
  }, [apps]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text className="text-[22px] font-medium text-paper">Track</Text>
        <Pressable testID="add-application" onPress={() => setShowForm((s) => !s)}>
          <Text className="text-[14px] font-medium text-brand">{showForm ? "Cancel" : "+ Add"}</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load applications" />
      ) : (
        <ScrollView
          contentContainerClassName="px-4 pb-10 pt-3 gap-5"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
        >
          <DemoBanner />

          {/* Stat strip */}
          <View className="flex-row gap-2">
            {stats.map((st) => (
              <View
                key={st.l}
                className="flex-1 items-center rounded-2xl border py-3"
                style={{ borderColor: colors.border, backgroundColor: colors.card }}
              >
                <Text className="text-[20px] font-medium" style={{ color: st.c }}>
                  {st.n}
                </Text>
                <Text className="mt-1 text-[10px] text-muted">{st.l}</Text>
              </View>
            ))}
          </View>

          {showForm && (
            <Card>
              <View className="gap-2">
                <Input label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Google" />
                <Input label="Role" value={role} onChangeText={setRole} placeholder="e.g. Senior SRE" />
                {err ? <Text className="text-xs text-bad">{err}</Text> : null}
                <Button label="Add application" onPress={onAdd} loading={add.isPending} />
              </View>
            </Card>
          )}

          {/* Grouped stages */}
          {groups.length === 0 ? (
            <EmptyState emoji="📋" title="Nothing here yet" subtitle="Evaluate a job to start tracking." />
          ) : (
            groups.map((g) => (
              <View key={g.key}>
                <View className="mb-2.5 flex-row items-center gap-2">
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.dot }} />
                  <SectionLabel>{`${g.label} · ${g.items.length}`}</SectionLabel>
                </View>
                <View className="gap-3">
                  {g.items.map((a) => (
                    <AppCard
                      key={a.num}
                      application={a}
                      onPress={() =>
                        router.push({ pathname: "/application/[num]", params: { num: a.num } })
                      }
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
