import { ActivityIndicator, FlatList, Linking, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResumes } from "@/hooks/useResumes";
import { resumeFileUrl } from "@/api/resumes";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ResumeQaButton } from "@/components/resume/ResumeQaButton";
import { colors } from "@/constants/theme";
import { relativeDate } from "@/utils/format";

export default function Resumes() {
  const { data, isLoading, isError, isRefetching, refetch } = useResumes();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader
        title="Resumes"
        subtitle={data ? `${data.groups.length} jobs · ${data.total} PDFs` : undefined}
        back
      />
      <DemoBanner />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color={colors.brand} />
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load resumes" />
      ) : (
        <FlatList
          data={data?.groups ?? []}
          keyExtractor={(g) => g.suffix}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-base font-semibold text-paper" numberOfLines={1}>
                  {item.displayName}
                </Text>
                <View className="rounded-md bg-bg-elevated px-2 py-0.5">
                  <Text className="text-[10px] text-muted">
                    {item.files.length} version{item.files.length > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <View className="mt-2 gap-1.5">
                {item.files.map((f) => (
                  <View key={f.name} className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">
                      v{f.version} · {relativeDate(f.mtime)}
                    </Text>
                    <Text
                      className="text-xs font-medium text-brand"
                      onPress={() => Linking.openURL(resumeFileUrl(f.url))}
                    >
                      Open PDF
                    </Text>
                  </View>
                ))}
              </View>
              {item.files[0] ? <ResumeQaButton file={item.files[0].name} /> : null}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState emoji="📑" title="No resumes yet" subtitle="Generate a tailored CV from a job." />
          }
        />
      )}
    </SafeAreaView>
  );
}
