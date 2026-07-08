import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useReports } from "@/hooks/useReports";
import { Card } from "@/components/ui/Card";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { colors } from "@/constants/theme";
import { relativeDate } from "@/utils/format";

export default function Reports() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useReports();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const reports = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) => r.company.toLowerCase().includes(q) || r.role.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Reports" subtitle={`${data?.length ?? 0} evaluations`} />
      <View className="px-4 pb-2">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search company or role…"
          autoCapitalize="none"
        />
      </View>
      <DemoBanner />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load reports" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: "/report/[id]", params: { id: item.id } })}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-white" numberOfLines={2}>
                    {item.role}
                  </Text>
                  <Text className="text-sm text-muted">{item.company}</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <Text className="text-xs text-muted">#{item.id}</Text>
                    {item.legitimacy ? (
                      <Text className="text-xs text-muted">• {item.legitimacy}</Text>
                    ) : null}
                    <Text className="text-xs text-muted">• {relativeDate(item.date)}</Text>
                  </View>
                </View>
                <ScoreBadge score={item.scoreNum} />
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState emoji="📄" title="No reports" subtitle={query ? "Try a different search." : "Evaluate a job to create one."} />
          }
        />
      )}
    </SafeAreaView>
  );
}
