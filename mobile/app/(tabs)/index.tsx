import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSummary } from "@/hooks/useSummary";
import { useApplications } from "@/hooks/useApplications";
import { useReports } from "@/hooks/useReports";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { SectionLabel, StreakDots, GhostShield, ghostShieldFromLegitimacy } from "@/components/ui/Meridian";
import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const DAY = 86_400_000;
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

export default function Today() {
  const router = useRouter();
  const { user } = useAuth();
  const summary = useSummary();
  const appsQ = useApplications();
  const reportsQ = useReports();

  const apps = appsQ.data ?? [];
  const reports = reportsQ.data ?? [];
  const s = summary.data;
  const name = user?.name || user?.email?.split("@")[0] || "there";

  const refreshing = summary.isRefetching || appsQ.isRefetching || reportsQ.isRefetching;
  const onRefresh = () => {
    summary.refetch();
    appsQ.refetch();
    reportsQ.refetch();
  };

  const topPick = useMemo(() => {
    return [...reports]
      .filter((r) => typeof r.scoreNum === "number")
      .sort((a, b) => (b.scoreNum ?? 0) - (a.scoreNum ?? 0))[0];
  }, [reports]);

  const momentum = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (iso?: string | null) => {
      if (!iso) return;
      const t = Date.parse(iso);
      if (Number.isNaN(t)) return;
      const k = dayKey(new Date(t));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    reports.forEach((r) => bump(r.date));
    apps.forEach((a) => bump(a.date));
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const n = counts.get(dayKey(d)) ?? 0;
      return { active: n > 0, n };
    });
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].active) streak++;
      else break;
    }
    const max = Math.max(1, ...days.map((d) => d.n));
    const total = days.reduce((sum, d) => sum + d.n, 0);
    return { days, streak, max, total };
  }, [reports, apps]);

  const actions = useMemo(() => {
    const out: { icon: string; title: string; desc: string; tag: string; tone: string; onPress: () => void }[] = [];
    for (const a of apps) {
      if (a.status === "Applied") {
        const d = daysSince(a.date);
        if (d != null && d >= 5) {
          out.push({
            icon: "⏰",
            title: `Follow up with ${a.company}`,
            desc: `${a.role} — day ${d}, no response`,
            tag: "Overdue",
            tone: colors.bad,
            onPress: () => router.push({ pathname: "/application/[num]", params: { num: a.num } }),
          });
        }
      }
    }
    for (const a of apps) {
      if (a.status === "Interview") {
        out.push({
          icon: "🎤",
          title: `Interview prep — ${a.company}`,
          desc: a.role || "In interview process",
          tag: "Prep",
          tone: colors.brand,
          onPress: () => router.push({ pathname: "/application/[num]", params: { num: a.num } }),
        });
      }
    }
    return out.slice(0, 3);
  }, [apps, router]);

  const stats = useMemo(() => {
    const by = s?.byStatus ?? {};
    return [
      { n: String(s?.counts.evaluated ?? 0), l: "Evaluated", c: colors.text },
      { n: String(by["Applied"] ?? 0), l: "Applied", c: colors.brand },
      { n: String(by["Interview"] ?? 0), l: "Interview", c: colors.good },
      { n: s?.avgScore != null ? s.avgScore.toFixed(1) : "—", l: "Avg score", c: colors.brand },
    ];
  }, [s]);

  const wins = useMemo(() => {
    const rank: Record<string, number> = { Offer: 3, Interview: 2, Responded: 1 };
    return apps
      .filter((a) => a.status in rank)
      .sort((x, y) => {
        const byDate = Date.parse(y.date) - Date.parse(x.date);
        return Number.isNaN(byDate) ? rank[y.status] - rank[x.status] : byDate;
      })
      .slice(0, 3)
      .map((a) => ({
        key: a.num,
        text:
          a.status === "Offer"
            ? `${a.company} — offer received`
            : a.status === "Interview"
              ? `${a.company} — in interviews`
              : `${a.company} — replied`,
      }));
  }, [apps]);

  const shield = topPick ? ghostShieldFromLegitimacy(topPick.legitimacy) : null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-4 pb-10 gap-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between pt-2">
          <View className="flex-1">
            <Text className="text-[22px] font-medium text-paper">
              {greeting()}, {name}
            </Text>
            <View className="mt-2 flex-row items-center gap-2.5">
              <StreakDots days={momentum.days} />
              <Text className="text-[13px] text-muted">
                {momentum.streak > 0 ? `${momentum.streak}-day streak 🔥` : "No streak yet"}
              </Text>
            </View>
          </View>
          <View
            className="ml-3 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.brand }}
          >
            <Text className="text-[13px] font-medium" style={{ color: colors.brandFg }}>
              {name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>

        <DemoBanner />

        {summary.isLoading ? (
          <ActivityIndicator className="mt-8" color={colors.brand} />
        ) : (
          <>
            {/* Hero job card */}
            {topPick ? (
              <View>
                <SectionLabel>Top pick today</SectionLabel>
                <View
                  className="overflow-hidden rounded-3xl border p-5"
                  style={{ borderColor: colors.borderStrong, backgroundColor: colors.card }}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[11px] font-medium tracking-wide text-brand">
                        {topPick.company.toUpperCase()}
                      </Text>
                      <Text className="mt-1 text-[18px] font-medium text-paper" numberOfLines={2}>
                        {topPick.role}
                      </Text>
                    </View>
                    <View
                      className="flex-row items-center rounded-2xl px-3 py-1.5"
                      style={{ backgroundColor: colors.amberDim }}
                    >
                      <Text className="text-[18px] font-medium" style={{ color: colors.brand }}>
                        ★ {topPick.scoreNum?.toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 flex-row flex-wrap items-center gap-2">
                    {topPick.location && (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.elevated }}>
                        <Text className="text-[11px] text-muted">{topPick.location}</Text>
                      </View>
                    )}
                    {topPick.archetype && (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.elevated }}>
                        <Text className="text-[11px] text-muted">{topPick.archetype.split("—")[0].trim()}</Text>
                      </View>
                    )}
                  </View>

                  {shield && (
                    <View className="mt-3">
                      <GhostShield status={shield.status} label={shield.label} />
                    </View>
                  )}

                  <View className="mt-4 flex-row gap-2">
                    <Pressable
                      onPress={() =>
                        topPick.id
                          ? router.push({ pathname: "/report/[id]", params: { id: topPick.id } })
                          : router.push("/evaluate")
                      }
                      className="flex-1 items-center rounded-xl py-2.5 active:opacity-80"
                      style={{ backgroundColor: colors.brand }}
                    >
                      <Text className="text-[13px] font-medium" style={{ color: colors.brandFg }}>
                        View report
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push("/resumes")}
                      className="flex-1 items-center rounded-xl border py-2.5 active:opacity-80"
                      style={{ borderColor: colors.border, backgroundColor: colors.elevated }}
                    >
                      <Text className="text-[13px] font-medium text-paper">Tailor CV</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <EmptyState
                emoji="✨"
                title="No evaluations yet"
                subtitle="Scan the portals or evaluate a job to see your top pick here."
              />
            )}

            {/* Next actions */}
            {actions.length > 0 && (
              <View>
                <SectionLabel>Next actions</SectionLabel>
                <View className="gap-2">
                  {actions.map((a, i) => (
                    <Pressable
                      key={i}
                      onPress={a.onPress}
                      className="flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-80"
                      style={{ borderColor: colors.border, backgroundColor: colors.card }}
                    >
                      <View
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: colors.elevated }}
                      >
                        <Text className="text-[15px]">{a.icon}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-medium text-paper">{a.title}</Text>
                        <Text className="mt-0.5 text-[11px] text-muted">{a.desc}</Text>
                      </View>
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${a.tone}22` }}>
                        <Text className="text-[10px] font-medium" style={{ color: a.tone }}>
                          {a.tag}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Stats strip */}
            <View>
              <SectionLabel>At a glance</SectionLabel>
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
            </View>

            {/* Activity this week — momentum bars */}
            <View>
              <View className="mb-2.5 flex-row items-baseline justify-between">
                <SectionLabel>Activity this week</SectionLabel>
                <Text className="text-[11px] text-subtle">
                  {momentum.total} action{momentum.total === 1 ? "" : "s"}
                </Text>
              </View>
              <View
                className="flex-row items-end justify-between rounded-2xl border px-4"
                style={{ height: 72, borderColor: colors.border, backgroundColor: colors.card, paddingVertical: 14 }}
              >
                {momentum.days.map((d, i) => {
                  const isToday = i === momentum.days.length - 1;
                  const h = Math.max(6, Math.round((d.n / momentum.max) * 44));
                  return (
                    <View
                      key={i}
                      style={{
                        width: 14,
                        height: h,
                        borderRadius: 3,
                        backgroundColor: isToday ? colors.brand : d.active ? colors.amberDim : colors.hover,
                      }}
                    />
                  );
                })}
              </View>
            </View>

            {/* Recent wins */}
            {wins.length > 0 && (
              <View>
                <SectionLabel>Recent wins 🏆</SectionLabel>
                <View className="gap-2">
                  {wins.map((w) => (
                    <View
                      key={w.key}
                      className="flex-row items-center gap-3 rounded-2xl p-3"
                      style={{ backgroundColor: colors.card }}
                    >
                      <View
                        className="h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.greenDim }}
                      >
                        <Text style={{ color: colors.good, fontSize: 11 }}>✓</Text>
                      </View>
                      <Text className="flex-1 text-[13px] text-muted">{w.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
