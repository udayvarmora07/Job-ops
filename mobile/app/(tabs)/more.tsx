import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useSummary } from "@/hooks/useSummary";
import { useApplications } from "@/hooks/useApplications";
import { useReports } from "@/hooks/useReports";
import { useProfile } from "@/hooks/useProfile";
import { SectionLabel, StreakDots, PrivacyBadge } from "@/components/ui/Meridian";
import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface Row {
  icon: string;
  label: string;
  sub: string;
  href: Href;
  count?: number;
}

export default function Me() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const summary = useSummary();
  const appsQ = useApplications();
  const reportsQ = useReports();
  const profileQ = useProfile();

  const c = summary.data?.counts;
  const apps = appsQ.data ?? [];
  const reports = reportsQ.data ?? [];

  const name = profileQ.data?.fullName || user?.name || user?.email?.split("@")[0] || "there";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const momentum = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (iso?: string | null) => {
      if (!iso) return;
      const t = Date.parse(iso);
      if (Number.isNaN(t)) return;
      counts.set(dayKey(new Date(t)), 1);
    };
    reports.forEach((r) => bump(r.date));
    apps.forEach((a) => bump(a.date));
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { active: counts.has(dayKey(d)) };
    });
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].active) streak++;
      else break;
    }
    return { days, streak };
  }, [reports, apps]);

  const summaryRows = useMemo(() => {
    const by = (st: string) => apps.filter((a) => a.status === st).length;
    const applied = ["Applied", "Responded", "Interview", "Offer", "Rejected"].reduce(
      (n, st) => n + by(st),
      0
    );
    return [
      { label: "Roles evaluated", value: String(c?.evaluated ?? 0) },
      { label: "Applications sent", value: String(applied) },
      { label: "Interviews", value: String(by("Interview") + by("Offer")) },
      {
        label: "Average score",
        value: summary.data?.avgScore != null ? summary.data.avgScore.toFixed(1) : "—",
      },
    ];
  }, [apps, c, summary.data]);

  const rows: Row[] = [
    { icon: "🤖", label: "Evaluate", sub: "AI job-fit evaluation", href: "/evaluate" },
    { icon: "✨", label: "AI Studio", sub: "Cover letters, interview prep", href: "/ai-studio" },
    { icon: "⚡", label: "Scan portals", sub: "Find new job postings", href: "/scan" },
    { icon: "📥", label: "Pipeline", sub: "Pending URLs to evaluate", href: "/pipeline", count: c?.inPipeline },
    { icon: "📄", label: "Reports", sub: "Your evaluation reports", href: "/(tabs)/reports", count: c?.reports },
    { icon: "📑", label: "Resumes", sub: "Tailored CV versions", href: "/resumes" },
    { icon: "🤝", label: "Referrals", sub: "Warm intros & asks", href: "/referrals", count: c?.referrals },
    { icon: "📧", label: "Outreach", sub: "Cold emails & follow-ups", href: "/outreach" },
    { icon: "👤", label: "Profile", sub: "Complete & edit your profile", href: "/profile" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-4 pb-10 gap-5">
        {/* Identity */}
        <View className="flex-row items-center gap-3 pt-3">
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.brand }}
          >
            <Text className="text-[18px] font-medium" style={{ color: colors.brandFg }}>
              {initials || "?"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-medium text-paper">{name}</Text>
            <Text className="text-[13px] text-muted">
              {profileQ.data?.targetRoles?.[0] || user?.email || "Job seeker"}
            </Text>
          </View>
        </View>

        {/* Streak / momentum */}
        <View
          className="rounded-2xl border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.card }}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[13px] font-medium text-paper">
                {momentum.streak > 0 ? `${momentum.streak}-day streak` : "Build your streak"}
              </Text>
              <Text className="mt-0.5 text-[11px] text-muted">Activity over the last 7 days</Text>
            </View>
            <Text style={{ fontSize: 22 }}>🔥</Text>
          </View>
          <View className="mt-3">
            <StreakDots days={momentum.days} />
          </View>
        </View>

        {/* 30-day summary */}
        <View>
          <SectionLabel>Last 30 days</SectionLabel>
          <View className="rounded-2xl border" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            {summaryRows.map((r, i) => (
              <View
                key={r.label}
                className="flex-row items-center justify-between px-4 py-3"
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
              >
                <Text className="text-[13px] text-muted">{r.label}</Text>
                <Text className="text-[15px] font-medium text-paper">{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Settings rows */}
        <View>
          <SectionLabel>Tools & settings</SectionLabel>
          <View className="rounded-2xl border" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            {rows.map((it, i) => (
              <Pressable
                key={it.label}
                onPress={() => router.push(it.href)}
                className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
              >
                <Text className="text-[18px]">{it.icon}</Text>
                <View className="flex-1">
                  <Text className="text-[14px] font-medium text-paper">{it.label}</Text>
                  <Text className="text-[11px] text-muted">{it.sub}</Text>
                </View>
                {typeof it.count === "number" && it.count > 0 && (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.elevated }}>
                    <Text className="text-[11px] text-muted">{it.count}</Text>
                  </View>
                )}
                <Text className="text-subtle">›</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View className="items-center gap-4 pt-1">
          <PrivacyBadge />
          <Pressable onPress={signOut}>
            <Text className="text-[14px] font-medium text-bad">Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
