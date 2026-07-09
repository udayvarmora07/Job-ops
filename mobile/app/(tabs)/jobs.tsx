import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useJobs } from "@/hooks/useJobs";
import { useReports } from "@/hooks/useReports";
import { useAddPipelineUrl } from "@/hooks/usePipeline";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoBanner } from "@/components/ui/DemoBanner";
import {
  PrivacyBadge,
  GhostShield,
  SalaryLine,
  ghostShieldFromLegitimacy,
} from "@/components/ui/Meridian";
import { colors } from "@/constants/theme";
import type { Job, Report } from "@/types";

type Filter = "all" | "pipeline" | "remote" | "evaluated";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pipeline", label: "In pipeline" },
  { key: "remote", label: "Remote" },
  { key: "evaluated", label: "Evaluated" },
];

const SWIPE = 120;

export default function Discover() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useJobs();
  const reportsQ = useReports();
  const addPipeline = useAddPipelineUrl();

  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);

  const reportByKey = useMemo(() => {
    const map = new Map<string, Report>();
    for (const r of reportsQ.data ?? [])
      map.set(`${r.company.toLowerCase()}::${(r.role || "").toLowerCase()}`, r);
    return map;
  }, [reportsQ.data]);

  const deck = useMemo(() => {
    const jobs = data ?? [];
    return jobs.filter((j) => {
      if (filter === "pipeline") return j.inPipeline;
      if (filter === "evaluated") return j.processed;
      if (filter === "remote") return /remote/i.test(j.location ?? "");
      return true;
    });
  }, [data, filter]);

  // Reset the deck when the filter changes.
  const filterRef = useRef(filter);
  if (filterRef.current !== filter) {
    filterRef.current = filter;
    if (index !== 0) setIndex(0);
  }

  const pos = useRef(new Animated.ValueXY()).current;

  function advance() {
    pos.setValue({ x: 0, y: 0 });
    setIndex((i) => i + 1);
  }

  function fling(dir: 1 | -1, then?: () => void) {
    Animated.timing(pos, {
      toValue: { x: dir * 500, y: 0 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      then?.();
      advance();
    });
  }

  function save(job: Job) {
    if (job.url) addPipeline.mutate(job.url);
    fling(1);
  }
  function skip() {
    fling(-1);
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: (_, g) => pos.setValue({ x: g.dx, y: g.dy * 0.2 }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE) {
          const job = deckRef.current[indexRef.current];
          if (job?.url) addPipeline.mutate(job.url);
          fling(1);
        } else if (g.dx < -SWIPE) {
          fling(-1);
        } else {
          Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  // Refs so the (stable) PanResponder always sees the latest deck/index.
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const indexRef = useRef(index);
  indexRef.current = index;

  const rotate = pos.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  function CardBody({ job }: { job: Job }) {
    const rep = reportByKey.get(`${job.company.toLowerCase()}::${(job.role || "").toLowerCase()}`);
    const shield = rep
      ? ghostShieldFromLegitimacy(rep.legitimacy)
      : ({ status: "suspicious", label: "Not yet evaluated" } as const);
    return (
      <View className="flex-1 p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[11px] font-medium tracking-wide text-brand">
              {job.company.toUpperCase()}
            </Text>
            <Text className="mt-1.5 text-[20px] font-medium text-paper" numberOfLines={3}>
              {job.role}
            </Text>
          </View>
          {rep?.scoreNum != null && (
            <View className="rounded-2xl px-3 py-1.5" style={{ backgroundColor: colors.amberDim }}>
              <Text className="text-[22px] font-medium" style={{ color: colors.brand }}>
                {rep.scoreNum.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        <View className="mt-4 flex-row flex-wrap items-center gap-2">
          {job.location && (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.elevated }}>
              <Text className="text-[12px] text-muted">{job.location}</Text>
            </View>
          )}
          {job.portal && (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.elevated }}>
              <Text className="text-[12px] text-muted">{job.portal.replace("-api", "")}</Text>
            </View>
          )}
          {job.expRequired && (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.elevated }}>
              <Text className="text-[12px] text-muted">{job.expRequired}</Text>
            </View>
          )}
        </View>

        <View className="mt-4">
          <SalaryLine salary={null} />
        </View>

        <View className="mt-auto">
          <GhostShield status={shield.status} label={shield.label} />
        </View>
      </View>
    );
  }

  const visible = deck.slice(index, index + 3);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-4 pb-8" scrollEnabled={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between pt-2">
          <View>
            <Text className="text-[22px] font-medium text-paper">Discover</Text>
            <Text className="mt-0.5 text-[13px] text-muted">
              {deck.length} open {deck.length === 1 ? "role" : "roles"}
            </Text>
          </View>
          <PrivacyBadge />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 py-4"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className="rounded-full border px-3.5 py-1.5"
                style={{
                  backgroundColor: active ? colors.amberDim : colors.card,
                  borderColor: active ? colors.brand : colors.border,
                }}
              >
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: active ? colors.brand : colors.muted }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <DemoBanner />

        {isLoading ? (
          <ActivityIndicator className="mt-16" color={colors.brand} />
        ) : isError ? (
          <EmptyState emoji="⚠️" title="Couldn't load jobs" subtitle="Check the backend API URL in settings." />
        ) : visible.length === 0 ? (
          <View className="mt-6">
            <EmptyState
              emoji="🎉"
              title="You're all caught up"
              subtitle={deck.length === 0 ? "Run a scan to find new roles." : "No more cards in this filter."}
            />
            {deck.length > 0 && (
              <Pressable onPress={() => setIndex(0)} className="mt-4 items-center">
                <Text className="text-[13px] font-medium text-brand">Start over</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {/* Card deck */}
            <View style={{ height: 420, marginTop: 4 }}>
              {visible
                .map((job, i) => ({ job, i }))
                .reverse()
                .map(({ job, i }) => {
                  const isTop = i === 0;
                  const depthStyle = {
                    transform: [{ scale: 1 - i * 0.04 }, { translateY: i * 14 }],
                  };
                  if (!isTop) {
                    return (
                      <View
                        key={job.url}
                        className="absolute left-0 right-0 rounded-3xl border"
                        style={[
                          { height: 420, borderColor: colors.border, backgroundColor: colors.card, opacity: 0.6 },
                          depthStyle,
                        ]}
                      >
                        <CardBody job={job} />
                      </View>
                    );
                  }
                  return (
                    <Animated.View
                      key={job.url}
                      {...panResponder.panHandlers}
                      className="absolute left-0 right-0 rounded-3xl border"
                      style={{
                        height: 420,
                        borderColor: colors.borderStrong,
                        backgroundColor: colors.card,
                        transform: [
                          { translateX: pos.x },
                          { translateY: pos.y },
                          { rotate },
                        ],
                      }}
                    >
                      <Pressable
                        onPress={() => router.push({ pathname: "/job/[url]", params: { url: job.url } })}
                        style={{ flex: 1 }}
                      >
                        <CardBody job={job} />
                      </Pressable>
                    </Animated.View>
                  );
                })}
            </View>

            {/* Action buttons */}
            <View className="mt-6 flex-row items-center justify-center gap-4">
              <Pressable
                onPress={skip}
                className="h-14 w-14 items-center justify-center rounded-full border"
                style={{ borderColor: colors.border, backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.bad, fontSize: 22 }}>✕</Text>
              </Pressable>
              <Pressable
                onPress={advance}
                className="h-12 w-12 items-center justify-center rounded-full border"
                style={{ borderColor: colors.border, backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.muted, fontSize: 18 }}>🕐</Text>
              </Pressable>
              <Pressable
                onPress={() => save(deck[index])}
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.brand }}
              >
                <Text style={{ color: colors.brandFg, fontSize: 20 }}>♥</Text>
              </Pressable>
            </View>
            <Text className="mt-3 text-center text-[11px] text-subtle">
              Swipe right to save · left to skip · tap the clock for later
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
