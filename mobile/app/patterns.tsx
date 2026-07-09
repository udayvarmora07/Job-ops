import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApplications } from "@/hooks/useApplications";
import { useReports } from "@/hooks/useReports";
import { useSummary } from "@/hooks/useSummary";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/Meridian";
import { colors } from "@/constants/theme";

/* ————————————————————————————————————————————————————————————————
   Rejection Intelligence (mobile) — port of the web PatternsView.
   CSS-free bars built from the applications tracker + evaluation reports.
   Every number traces back to a real count.
———————————————————————————————————————————————————————————————— */

const REACHED = {
  applied: ["Applied", "Responded", "Interview", "Offer", "Rejected"],
  responded: ["Responded", "Interview", "Offer"],
  interview: ["Interview", "Offer"],
  offer: ["Offer"],
};

const SCORE_BANDS = [
  { label: "< 3.0", min: -Infinity, max: 3.0 },
  { label: "3.0–3.5", min: 3.0, max: 3.5 },
  { label: "3.5–4.0", min: 3.5, max: 4.0 },
  { label: "4.0–4.5", min: 4.0, max: 4.5 },
  { label: "4.5–5.0", min: 4.5, max: Infinity },
];

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

type Tone = "accent" | "danger" | "success" | "muted";

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: Tone }) {
  const width = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  const fill = {
    accent: colors.brand,
    danger: colors.bad,
    success: colors.good,
    muted: colors.muted,
  }[tone];
  return (
    <View className="flex-row items-center gap-3">
      <Text className="w-[76px] text-[12px] text-muted">{label}</Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.elevated }}>
        <View style={{ height: "100%", width: `${width}%`, backgroundColor: fill, borderRadius: 999 }} />
      </View>
      <Text className="w-[34px] text-right text-[13px] font-medium text-paper">{value}</Text>
    </View>
  );
}

export default function Patterns() {
  const { data: appsData } = useApplications();
  const { data: reportsData } = useReports();
  const summary = useSummary();

  const apps = appsData ?? [];
  const reports = reportsData ?? [];
  const s = summary.data;

  const funnel = useMemo(() => {
    const count = (set: string[]) => apps.filter((a) => set.includes(a.status)).length;
    const applied = count(REACHED.applied);
    const responded = count(REACHED.responded);
    const interview = count(REACHED.interview);
    const offer = count(REACHED.offer);
    return [
      { label: "Applied", n: applied, conv: null as number | null },
      { label: "Responded", n: responded, conv: pct(responded, applied) },
      { label: "Interview", n: interview, conv: pct(interview, responded) },
      { label: "Offer", n: offer, conv: pct(offer, interview) },
    ];
  }, [apps]);

  const biggestLeak = useMemo(() => {
    let worst: { from: string; to: string; kept: number; lost: number } | null = null;
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1];
      const cur = funnel[i];
      if (prev.n === 0) continue;
      const lost = prev.n - cur.n;
      if (lost <= 0) continue;
      if (!worst || lost > worst.lost) worst = { from: prev.label, to: cur.label, kept: cur.conv ?? 0, lost };
    }
    return worst;
  }, [funnel]);

  const scored = useMemo(
    () => reports.filter((r) => typeof r.scoreNum === "number") as (typeof reports),
    [reports]
  );
  const distribution = useMemo(
    () =>
      SCORE_BANDS.map((b) => ({
        label: b.label,
        n: scored.filter((r) => (r.scoreNum ?? 0) >= b.min && (r.scoreNum ?? 0) < b.max).length,
      })),
    [scored]
  );
  const distMax = Math.max(1, ...distribution.map((d) => d.n));

  const rejections = useMemo(
    () => apps.filter((a) => a.status === "Rejected" && typeof a.scoreNum === "number"),
    [apps]
  );
  const rejByBand = useMemo(
    () =>
      SCORE_BANDS.map((b) => ({
        label: b.label,
        n: rejections.filter((a) => (a.scoreNum ?? 0) >= b.min && (a.scoreNum ?? 0) < b.max).length,
      })),
    [rejections]
  );
  const rejMax = Math.max(1, ...rejByBand.map((d) => d.n));
  const highFitRejections = rejByBand
    .filter((b) => b.label.startsWith("4"))
    .reduce((acc, b) => acc + b.n, 0);

  const actions = useMemo(() => {
    const out: { title: string; body: string }[] = [];
    const evaluated = reports.length;
    const appliedN = funnel[0].n;
    const respRate = s?.rates?.response ?? funnel[1].conv ?? 0;
    const interviewsLive = apps.filter((a) => a.status === "Interview").length;
    const offers = funnel[3].n;

    if (offers > 0)
      out.push({
        title: "You have an offer on the table",
        body: "Run the negotiation playbook before you respond — anchor high and let silence work for you.",
      });
    if (interviewsLive > 0)
      out.push({
        title: `Prep your ${interviewsLive} live interview${interviewsLive > 1 ? "s" : ""}`,
        body: "Generate a company-specific interview guide and rehearse two STAR+R stories per role.",
      });
    if (highFitRejections >= 2)
      out.push({
        title: "High-fit roles are being rejected",
        body: `${highFitRejections} rejections came from 4.0+ matches. The gap is likely presentation, not fit — tighten the CV and lead with proof points.`,
      });
    if (appliedN >= 3 && respRate < 25)
      out.push({
        title: `Response rate is ${Math.round(respRate)}%`,
        body: "Cold applications are underperforming. Route your top picks through a referral or warm outreach before applying.",
      });
    if (evaluated >= 5 && appliedN / Math.max(1, evaluated) < 0.4)
      out.push({
        title: "You're evaluating more than you apply",
        body: `${evaluated} roles evaluated, ${appliedN} applications sent. Convert your highest-scoring picks — quality is already there.`,
      });
    if (out.length === 0)
      out.push({
        title: "Not enough signal yet",
        body: "Apply to a few of your top picks. Once outcomes land, this page shows exactly where the funnel leaks.",
      });
    return out.slice(0, 4);
  }, [reports, apps, funnel, s, highFitRejections]);

  const totalApps = funnel[0].n;
  const hasData = reports.length > 0 || totalApps > 0;

  const glance = [
    { label: "Applications sent", value: String(totalApps) },
    { label: "Response rate", value: `${funnel[1].conv ?? 0}%` },
    { label: "Interview rate", value: `${funnel[2].conv ?? 0}%` },
    { label: "Average fit score", value: s?.avgScore != null ? s.avgScore.toFixed(1) : "—" },
    { label: "High-fit rejections", value: String(highFitRejections) },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Rejection intelligence" back />
      {!hasData ? (
        <EmptyState
          emoji="📊"
          title="No patterns yet"
          subtitle="Evaluate roles and send applications. Once outcomes land, this reveals where you convert and stall."
        />
      ) : (
        <ScrollView contentContainerClassName="px-4 pb-10 gap-7 pt-2">
          <Text className="text-[13px] text-muted">
            Built from {reports.length} evaluation{reports.length === 1 ? "" : "s"} and {totalApps}{" "}
            application{totalApps === 1 ? "" : "s"}. Every bar is a real count.
          </Text>

          {/* Funnel */}
          <View>
            <SectionLabel>Application funnel</SectionLabel>
            <View className="gap-3">
              {funnel.map((f) => (
                <View key={f.label} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Bar label={f.label} value={f.n} max={totalApps} tone="accent" />
                  </View>
                  <Text className="w-[38px] text-right text-[12px] text-subtle">
                    {f.conv != null ? `${f.conv}%` : ""}
                  </Text>
                </View>
              ))}
            </View>
            {biggestLeak && (
              <View className="mt-4 flex-row gap-2 rounded-xl p-3" style={{ backgroundColor: colors.redDim }}>
                <Text style={{ color: colors.bad }}>▼</Text>
                <Text className="flex-1 text-[13px] text-muted">
                  Biggest drop-off is{" "}
                  <Text className="text-paper">
                    {biggestLeak.from} → {biggestLeak.to}
                  </Text>
                  : {biggestLeak.lost} lost, only {biggestLeak.kept}% carried through. That's the stage to work on.
                </Text>
              </View>
            )}
          </View>

          {/* Score distribution */}
          <View>
            <SectionLabel>Score distribution — everything you evaluated</SectionLabel>
            {scored.length > 0 ? (
              <View className="gap-3">
                {distribution.map((d) => (
                  <Bar key={d.label} label={d.label} value={d.n} max={distMax} tone={d.label.startsWith("4") ? "success" : "muted"} />
                ))}
              </View>
            ) : (
              <Text className="text-[13px] text-subtle">No scored evaluations yet.</Text>
            )}
          </View>

          {/* Rejections by band */}
          <View>
            <SectionLabel>Rejections by fit score</SectionLabel>
            {rejections.length > 0 ? (
              <>
                <View className="gap-3">
                  {rejByBand.map((d) => (
                    <Bar key={d.label} label={d.label} value={d.n} max={rejMax} tone={d.label.startsWith("4") ? "danger" : "muted"} />
                  ))}
                </View>
                <Text className="mt-3 text-[12px] text-subtle">
                  Rejections in the 4.0+ bands sting most — high-fit roles where the application, not the match, fell short.
                </Text>
              </>
            ) : (
              <Text className="text-[13px] text-subtle">No rejections recorded. Keep it that way.</Text>
            )}
          </View>

          {/* Do this next */}
          <View>
            <SectionLabel>Do this next</SectionLabel>
            <View className="gap-3">
              {actions.map((a, i) => (
                <View key={i} className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
                  <View className="mb-1.5 flex-row items-center gap-2">
                    <Text style={{ color: colors.brand }}>💡</Text>
                    <Text className="text-[13px] font-medium text-paper">{a.title}</Text>
                  </View>
                  <Text className="text-[12px] leading-relaxed text-muted">{a.body}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* At a glance */}
          <View>
            <SectionLabel>At a glance</SectionLabel>
            <View className="rounded-2xl border" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
              {glance.map((g, i) => (
                <View
                  key={g.label}
                  className="flex-row items-center justify-between px-4 py-3"
                  style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
                >
                  <Text className="text-[13px] text-muted">{g.label}</Text>
                  <Text className="text-[14px] font-medium text-paper">{g.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
