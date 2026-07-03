import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApplications } from "@/hooks/useApplications";
import { AppCard } from "@/components/application/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors } from "@/constants/theme";

const FILTERS = ["All", "Evaluated", "Applied", "Interview", "Offer", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

export default function Applications() {
  const { data, isLoading, isError, isRefetching, refetch } = useApplications();
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const apps = data ?? [];
    if (filter === "All") return apps;
    return apps.filter((a) => a.status === filter);
  }, [data, filter]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <Text className="text-2xl font-bold text-white">Applications</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => {
            const active = filter === item;
            return (
              <Pressable
                testID={`filter-${item}`}
                onPress={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 ${active ? "bg-brand" : "bg-bg-elevated"}`}
              >
                <Text className={`text-sm ${active ? "text-white" : "text-muted"}`}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load applications" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.num}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => <AppCard application={item} />}
          ListEmptyComponent={
            <EmptyState
              emoji="📋"
              title="Nothing here"
              subtitle={filter === "All" ? "No applications yet." : `No ${filter} applications.`}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
