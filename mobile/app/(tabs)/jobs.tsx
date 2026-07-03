import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useJobs } from "@/hooks/useJobs";
import { JobCard } from "@/components/job/JobCard";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors } from "@/constants/theme";

export default function Jobs() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useJobs();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const jobs = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.role.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <Text className="text-2xl font-bold text-white">Jobs</Text>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search role, company, location…"
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState
          emoji="⚠️"
          title="Couldn't load jobs"
          subtitle="Check the backend API URL in your settings."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(j) => j.url}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() =>
                router.push({ pathname: "/job/[url]", params: { url: item.url } })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="🔍"
              title="No jobs found"
              subtitle={query ? "Try a different search." : "Run a scan to find jobs."}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
