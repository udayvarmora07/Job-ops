import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAddApplication, useApplications } from "@/hooks/useApplications";
import { AppCard } from "@/components/application/AppCard";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { colors } from "@/constants/theme";

const FILTERS = ["All", "Evaluated", "Applied", "Interview", "Offer", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

export default function Applications() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useApplications();
  const add = useAddApplication();
  const [filter, setFilter] = useState<Filter>("All");
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
      setCompany(""); setRole(""); setShowForm(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    }
  }

  const filtered = useMemo(() => {
    const apps = data ?? [];
    if (filter === "All") return apps;
    return apps.filter((a) => a.status === filter);
  }, [data, filter]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Applications</Text>
          <Pressable testID="add-application" onPress={() => setShowForm((s) => !s)}>
            <Text className="text-sm font-semibold text-brand">{showForm ? "Cancel" : "+ Add"}</Text>
          </Pressable>
        </View>
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

      <DemoBanner />

      {showForm ? (
        <View className="mx-4 mb-2">
          <Card>
            <View className="gap-2">
              <Input label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Google" />
              <Input label="Role" value={role} onChangeText={setRole} placeholder="e.g. Senior SRE" />
              {err ? <Text className="text-xs text-bad">{err}</Text> : null}
              <Button label="Add application" onPress={onAdd} loading={add.isPending} />
            </View>
          </Card>
        </View>
      ) : null}

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
          renderItem={({ item }) => (
            <AppCard
              application={item}
              onPress={() =>
                router.push({ pathname: "/application/[num]", params: { num: item.num } })
              }
            />
          )}
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
