import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSummary } from "@/hooks/useSummary";
import { useApplications } from "@/hooks/useApplications";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/application/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
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

        {summary.isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : summary.isError ? (
          <ErrorNote message="Couldn't reach the backend. Check API URL in settings." />
        ) : (
          <View className="flex-row gap-3">
            <StatCard
              value={summary.data?.counts.fetchedJobs ?? 0}
              label="Jobs"
              accent={colors.info}
            />
            <StatCard
              value={summary.data?.counts.evaluated ?? 0}
              label="Evaluated"
              accent={colors.brand}
            />
            <StatCard
              value={summary.data?.counts.inPipeline ?? 0}
              label="Pipeline"
              accent={colors.warn}
            />
          </View>
        )}

        <View className="gap-3">
          <Text className="text-lg font-semibold text-white">Recent applications</Text>
          {apps.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : recent.length === 0 ? (
            <EmptyState
              emoji="📋"
              title="No applications yet"
              subtitle="Evaluate a job to get started."
            />
          ) : (
            recent.map((a) => (
              <AppCard
                key={a.num}
                application={a}
                onPress={() => router.push("/(tabs)/applications")}
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
