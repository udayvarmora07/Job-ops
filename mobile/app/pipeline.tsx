import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePipeline, useAddPipelineUrl, useRemovePipelineUrl } from "@/hooks/usePipeline";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { colors } from "@/constants/theme";
import { hostFromUrl } from "@/utils/format";

export default function Pipeline() {
  const { data, isLoading, isError, isRefetching, refetch } = usePipeline();
  const add = useAddPipelineUrl();
  const remove = useRemovePipelineUrl();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onAdd() {
    setErr(null);
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) {
      setErr("Enter a valid http(s) URL");
      return;
    }
    try {
      await add.mutateAsync(u);
      setUrl("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Pipeline" subtitle={`${data?.length ?? 0} pending`} back />
      <View className="gap-2 px-4 pb-2">
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="Paste a job URL…"
          autoCapitalize="none"
          keyboardType="url"
          error={err ?? undefined}
        />
        <Button label="Add to pipeline" onPress={onAdd} loading={add.isPending} />
      </View>
      <DemoBanner />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load pipeline" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.url}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <Card onPress={() => Linking.openURL(item.url)}>
              <Text className="text-base font-semibold text-white" numberOfLines={2}>
                {item.role || "Untitled role"}
              </Text>
              <Text className="text-sm text-muted">{item.company || hostFromUrl(item.url)}</Text>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-xs text-muted">
                  {item.hasJd ? "JD captured" : "URL only"} • {hostFromUrl(item.url)}
                </Text>
                <Text
                  className="text-xs text-bad"
                  onPress={() => remove.mutate(item.url)}
                >
                  Remove
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState emoji="📥" title="Pipeline empty" subtitle="Add a job URL above to queue it for evaluation." />
          }
        />
      )}
    </SafeAreaView>
  );
}
