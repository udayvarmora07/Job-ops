import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAddReferral, useDeleteReferral, useReferrals } from "@/hooks/useReferrals";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { colors } from "@/constants/theme";
import { relativeDate } from "@/utils/format";

export default function Referrals() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useReferrals();
  const add = useAddReferral();
  const del = useDeleteReferral();
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [contact, setContact] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onAdd() {
    setErr(null);
    if (!company.trim()) {
      setErr("Company is required");
      return;
    }
    try {
      await add.mutateAsync({ company: company.trim(), role: role.trim(), contact: contact.trim() });
      setCompany(""); setRole(""); setContact(""); setShowForm(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader
        title="Referrals"
        subtitle={`${data?.length ?? 0} contacts`}
        back
        right={
          <View className="flex-row items-center gap-3">
            <Pressable testID="find-contacts" onPress={() => router.push("/referral-finder")}>
              <Text className="text-sm font-semibold text-brand">🔎 Find</Text>
            </Pressable>
            <Pressable testID="add-referral" onPress={() => setShowForm((s) => !s)}>
              <Text className="text-sm font-semibold text-brand">{showForm ? "Cancel" : "+ Add"}</Text>
            </Pressable>
          </View>
        }
      />
      <DemoBanner />

      {showForm ? (
        <View className="mx-4 mb-2">
          <Card>
            <View className="gap-2">
              <Input label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Stripe" />
              <Input label="Role" value={role} onChangeText={setRole} placeholder="e.g. Platform Engineer" />
              <Input label="Contact" value={contact} onChangeText={setContact} placeholder="e.g. Alex Rivera" />
              {err ? <Text className="text-xs text-bad">{err}</Text> : null}
              <Button label="Add referral" onPress={onAdd} loading={add.isPending} />
            </View>
          </Card>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load referrals" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-paper">{item.contact}</Text>
                  <Text className="text-sm text-muted">
                    {item.role} @ {item.company}
                  </Text>
                  {item.note ? (
                    <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
                      {item.note}
                    </Text>
                  ) : null}
                  <View className="mt-1 flex-row items-center gap-2">
                    <Text className="text-xs text-muted">{item.channel}</Text>
                    <Text className="text-xs text-muted">• {relativeDate(item.updatedAt)}</Text>
                    <Text className="text-xs text-bad" onPress={() => del.mutate(item.id)}>
                      Delete
                    </Text>
                  </View>
                </View>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState emoji="🤝" title="No referrals" subtitle="Track warm intros and referral asks here." />
          }
        />
      )}
    </SafeAreaView>
  );
}
