import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useSummary } from "@/hooks/useSummary";
import { useApplications } from "@/hooks/useApplications";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AppCard } from "@/components/application/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const summary = useSummary();
  const apps = useApplications();

  const refreshing = summary.isRefetching || apps.isRefetching;
  const onRefresh = () => {
    summary.refetch();
    apps.refetch();
  };

  const recent = (apps.data ?? []).slice(0, 5);
  const name = user?.name || user?.email?.split("@")[0] || "there";
  const s = summary.data;

  const quickLinks: { icon: string; label: string; href: Href }[] = [
    { icon: "🔍", label: "Jobs", href: "/(tabs)/jobs" },
    { icon: "📄", label: "Reports", href: "/(tabs)/reports" },
    { icon: "📥", label: "Pipeline", href: "/pipeline" },
    { icon: "📑", label: "Resumes", href: "/resumes" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-4 pb-8 gap-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        <View className="pt-2">
          <Text className="text-2xl font-bold text-white">
            {greeting()}, {name}
          </Text>
          <Text className="text-sm text-muted">Here&apos;s your search at a glance.</Text>
        </View>

        <DemoBanner />

        {/* Primary actions */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button label="🤖 Evaluate a job" onPress={() => router.push("/evaluate")} />
          </View>
          <View className="flex-1">
            <Button label="⚡ Scan portals" variant="secondary" onPress={() => router.push("/scan")} />
          </View>
        </View>

        {summary.isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : summary.isError ? (
          <ErrorNote message="Couldn't reach the backend. Check API URL in settings." />
        ) : (
          <>
            <View className="flex-row gap-3">
              <StatCard value={s?.counts.fetchedJobs ?? 0} label="Jobs" accent={colors.info} />
              <StatCard value={s?.counts.evaluated ?? 0} label="Evaluated" accent={colors.brand} />
              <StatCard value={s?.counts.inPipeline ?? 0} label="Pipeline" accent={colors.warn} />
            </View>

            {/* Pipeline funnel */}
            {s?.funnel?.length ? (
              <Card>
                <Text className="mb-3 text-sm font-semibold text-white">Pipeline funnel</Text>
                <View className="gap-2">
                  {s.funnel.map((f) => (
                    <View key={f.label} className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">{f.label}</Text>
                        <Text className="text-xs text-muted">{f.count}</Text>
                      </View>
                      <View className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                        <View
                          style={{ width: `${Math.max(2, f.pct)}%`, backgroundColor: colors.brand }}
                          className="h-2 rounded-full"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Conversion rates */}
            {s?.rates ? (
              <View className="flex-row gap-3">
                <StatCard value={`${s.rates.response}%`} label="Response" accent={colors.brand} />
                <StatCard value={`${s.rates.interview}%`} label="Interview" accent={colors.info} />
                <StatCard value={`${s.rates.offer}%`} label="Offer" accent={colors.good} />
              </View>
            ) : null}
          </>
        )}

        {/* Quick links */}
        <View className="flex-row gap-3">
          {quickLinks.map((q) => (
            <Pressable
              key={q.label}
              onPress={() => router.push(q.href)}
              className="flex-1 items-center gap-1 rounded-2xl border border-border bg-bg-card py-3 active:opacity-80"
            >
              <Text className="text-xl">{q.icon}</Text>
              <Text className="text-xs text-muted">{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-white">Recent applications</Text>
          {apps.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : recent.length === 0 ? (
            <EmptyState emoji="📋" title="No applications yet" subtitle="Evaluate a job to get started." />
          ) : (
            recent.map((a) => (
              <AppCard
                key={a.num}
                application={a}
                onPress={() => router.push({ pathname: "/application/[num]", params: { num: a.num } })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <View className="rounded-xl border border-bad/40 bg-bad/10 p-4">
      <Text className="text-sm text-bad">{message}</Text>
    </View>
  );
}
