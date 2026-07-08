import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOutreach } from "@/hooks/useOutreach";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { colors } from "@/constants/theme";
import { relativeDate } from "@/utils/format";

export default function Outreach() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useOutreach();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader
        title="Outreach"
        subtitle={`${data?.length ?? 0} contacts`}
        back
        right={
          <Pressable testID="compose-outreach" onPress={() => router.push("/outreach-compose")}>
            <Text className="text-sm font-semibold text-brand">✍️ Compose</Text>
          </Pressable>
        }
      />
      <DemoBanner />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load outreach" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(o) => o.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-white">
                    {item.contactName || item.email}
                  </Text>
                  <Text className="text-sm text-muted">
                    {item.role} @ {item.company}
                  </Text>
                  {item.subject ? (
                    <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
                      ✉️ {item.subject}
                    </Text>
                  ) : null}
                  <View className="mt-1 flex-row items-center gap-2">
                    <Text
                      className="text-xs text-brand"
                      onPress={() => item.email && Linking.openURL(`mailto:${item.email}`)}
                    >
                      {item.email}
                    </Text>
                    {item.sentDate ? (
                      <Text className="text-xs text-muted">• sent {relativeDate(item.sentDate)}</Text>
                    ) : null}
                  </View>
                </View>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState emoji="📧" title="No outreach" subtitle="Cold emails and follow-ups show here." />
          }
        />
      )}
    </SafeAreaView>
  );
}
