"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Target, Lightbulb } from "lucide-react";
import type { Application, ReportMeta, Summary } from "@/lib/types";

/* ————————————————————————————————————————————————————————————————
   PatternsView — Rejection Intelligence (Meridian).

   A calm, editorial analytics view built entirely from data already in
   hand: the applications tracker (apps) and evaluation reports (reports).
   CSS bars only — no chart library, no fabricated numbers. Every insight
   traces back to a count you can see on the page.
———————————————————————————————————————————————————————————————— */

interface PatternsViewProps {
  apps: Application[];
  reports: ReportMeta[];
  summary: Summary | null;
  loading: boolean;
}

/* Statuses that mean "this application reached at least stage X". */
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

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** A single labelled horizontal bar. */
function Bar({
  label,
  value,
  max,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  tone: "accent" | "danger" | "warning" | "success" | "muted";
  suffix?: string;
}) {
  const width = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  const fill = {
    accent: "var(--fill-accent)",
    danger: "var(--text-danger)",
    warning: "var(--text-warning)",
    success: "var(--text-success)",
    muted: "var(--text-muted)",
  }[tone];
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
      <span className="text-[13px] text-[color:var(--text-secondary)]">{label}</span>
      <div
        className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-2)]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${width}%`, background: fill }}
        />
      </div>
      <span className="min-w-[52px] text-right text-[13px] font-medium tabular-nums text-[color:var(--text-primary)]">
        {value}
        {suffix ? <span className="text-[color:var(--text-muted)]"> {suffix}</span> : null}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-[11px] font-medium tracking-wide text-[color:var(--text-muted)]">
      {children}
    </div>
  );
}

export function PatternsView({ apps, reports, summary, loading }: PatternsViewProps) {
  /* ——— Funnel: how far applications travel ——— */
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

  /* Largest drop-off between adjacent stages — the leak to fix. */
  const biggestLeak = useMemo(() => {
    let worst: { from: string; to: string; kept: number; lost: number } | null = null;
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1];
      const cur = funnel[i];
      if (prev.n === 0) continue;
      const lost = prev.n - cur.n;
      if (lost <= 0) continue;
      if (!worst || lost > worst.lost) {
        worst = { from: prev.label, to: cur.label, kept: cur.conv ?? 0, lost };
      }
    }
    return worst;
  }, [funnel]);

  /* ——— Score distribution across everything evaluated ——— */
  const scored = useMemo(
    () => reports.filter((r) => typeof r.scoreNum === "number") as (ReportMeta & { scoreNum: number })[],
    [reports]
  );
  const distribution = useMemo(() => {
    return SCORE_BANDS.map((b) => ({
      label: b.label,
      n: scored.filter((r) => r.scoreNum >= b.min && r.scoreNum < b.max).length,
    }));
  }, [scored]);
  const distMax = Math.max(1, ...distribution.map((d) => d.n));

  /* ——— Rejections by score band: are high-fit roles slipping? ——— */
  const rejections = useMemo(
    () => apps.filter((a) => a.status === "Rejected" && typeof a.scoreNum === "number"),
    [apps]
  );
  const rejByBand = useMemo(() => {
    return SCORE_BANDS.map((b) => ({
      label: b.label,
      n: rejections.filter((a) => (a.scoreNum ?? 0) >= b.min && (a.scoreNum ?? 0) < b.max).length,
    }));
  }, [rejections]);
  const rejMax = Math.max(1, ...rejByBand.map((d) => d.n));
  const highFitRejections = rejByBand
    .filter((b) => b.label.startsWith("4"))
    .reduce((acc, b) => acc + b.n, 0);

  /* ——— Recommended actions: rule-based, from the patterns above ——— */
  const actions = useMemo(() => {
    const out: { title: string; body: string }[] = [];
    const evaluated = reports.length;
    const appliedN = funnel[0].n;
    const respRate = summary?.rates.response ?? funnel[1].conv ?? 0;
    const interviewsLive = apps.filter((a) => a.status === "Interview").length;
    const offers = funnel[3].n;

    if (offers > 0) {
      out.push({
        title: "You have an offer on the table",
        body: "Run the negotiation playbook before you respond — anchor high and let silence work for you.",
      });
    }
    if (interviewsLive > 0) {
      out.push({
        title: `Prep your ${interviewsLive} live interview${interviewsLive > 1 ? "s" : ""}`,
        body: "Generate a company-specific interview guide and rehearse two STAR+R stories per role.",
      });
    }
    if (highFitRejections >= 2) {
      out.push({
        title: "High-fit roles are being rejected",
        body: `${highFitRejections} rejections came from 4.0+ matches. The gap is likely presentation, not fit — tighten the CV and lead with proof points.`,
      });
    }
    if (appliedN >= 3 && respRate < 25) {
      out.push({
        title: `Response rate is ${Math.round(respRate)}%`,
        body: "Cold applications are underperforming. Route your top picks through a referral or warm outreach before applying.",
      });
    }
    if (evaluated >= 5 && appliedN / Math.max(1, evaluated) < 0.4) {
      out.push({
        title: "You're evaluating more than you apply",
        body: `${evaluated} roles evaluated, ${appliedN} applications sent. Convert your highest-scoring picks — quality is already there.`,
      });
    }
    if (out.length === 0) {
      out.push({
        title: "Not enough signal yet",
        body: "Apply to a few of your top picks. Once outcomes land, this page will show exactly where the funnel leaks.",
      });
    }
    return out.slice(0, 4);
  }, [reports, apps, funnel, summary, highFitRejections]);

  const totalApps = funnel[0].n;
  const hasData = reports.length > 0 || totalApps > 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1180px] py-16 text-center text-[14px] text-[color:var(--text-muted)]">
        Reading your applications and reports…
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-[1180px]"
    >
      <div className="mb-8">
        <div className="mb-2 text-[13px] text-[color:var(--text-muted)]">Rejection intelligence</div>
        <h2 className="text-[22px] font-medium text-[color:var(--text-primary)]">
          Where your search is leaking
        </h2>
        <p className="mt-2 max-w-xl text-[14px] text-[color:var(--text-secondary)]">
          Built from {reports.length} evaluation{reports.length === 1 ? "" : "s"} and {totalApps}{" "}
          application{totalApps === 1 ? "" : "s"}. Every bar is a real count from your tracker.
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-8 py-16 text-center">
          <h3 className="text-[18px] font-medium text-[color:var(--text-primary)]">
            No patterns to show yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-[color:var(--text-muted)]">
            Evaluate a few roles and send some applications. Once outcomes come back, this page
            reveals where you convert and where you stall.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* LEFT — the charts */}
          <div className="flex flex-col gap-11 lg:border-r lg:border-[color:var(--border-subtle)] lg:pr-14">
            {/* Funnel */}
            <section>
              <SectionLabel>Application funnel</SectionLabel>
              <div className="flex flex-col gap-3.5">
                {funnel.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Bar label={s.label} value={s.n} max={totalApps} tone="accent" />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-[color:var(--text-muted)]">
                      {s.conv != null ? `${s.conv}%` : ""}
                    </span>
                  </div>
                ))}
              </div>
              {biggestLeak && (
                <div className="mt-5 flex items-start gap-2.5 rounded-md bg-[color:var(--bg-danger)] px-3.5 py-3">
                  <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--text-danger)]" />
                  <p className="text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                    Biggest drop-off is{" "}
                    <span className="text-[color:var(--text-primary)]">
                      {biggestLeak.from} → {biggestLeak.to}
                    </span>
                    : {biggestLeak.lost} lost, only {biggestLeak.kept}% carried through. That's the
                    stage to work on.
                  </p>
                </div>
              )}
            </section>

            {/* Score distribution */}
            <section>
              <SectionLabel>Score distribution — everything you evaluated</SectionLabel>
              {scored.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  {distribution.map((d) => (
                    <Bar
                      key={d.label}
                      label={d.label}
                      value={d.n}
                      max={distMax}
                      tone={d.label.startsWith("4") ? "success" : "muted"}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[color:var(--text-muted)]">
                  No scored evaluations yet.
                </p>
              )}
            </section>

            {/* Rejections by score band */}
            <section>
              <SectionLabel>Rejections by fit score</SectionLabel>
              {rejections.length > 0 ? (
                <>
                  <div className="flex flex-col gap-3.5">
                    {rejByBand.map((d) => (
                      <Bar
                        key={d.label}
                        label={d.label}
                        value={d.n}
                        max={rejMax}
                        tone={d.label.startsWith("4") ? "danger" : "muted"}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-[12px] leading-relaxed text-[color:var(--text-muted)]">
                    Rejections in the 4.0+ bands are the ones that sting — high-fit roles where the
                    application, not the match, fell short.
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-[color:var(--text-muted)]">
                  No rejections recorded. Keep it that way.
                </p>
              )}
            </section>
          </div>

          {/* RIGHT — recommended actions + at-a-glance */}
          <aside className="flex flex-col gap-9">
            <div>
              <SectionLabel>Do this next</SectionLabel>
              <div className="flex flex-col gap-4">
                {actions.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-4"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 shrink-0 text-[color:var(--text-warning)]" />
                      <span className="text-[13px] font-medium text-[color:var(--text-primary)]">
                        {a.title}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-[color:var(--text-muted)]">
                      {a.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>At a glance</SectionLabel>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Applications sent", value: String(totalApps) },
                  { label: "Response rate", value: `${funnel[1].conv ?? 0}%` },
                  { label: "Interview rate", value: `${funnel[2].conv ?? 0}%` },
                  {
                    label: "Average fit score",
                    value: summary?.avgScore != null ? summary.avgScore.toFixed(1) : "—",
                  },
                  {
                    label: "High-fit rejections",
                    value: String(highFitRejections),
                  },
                ].map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between text-[13px]">
                    <span className="text-[color:var(--text-secondary)]">{s.label}</span>
                    <span className="font-medium tabular-nums text-[color:var(--text-primary)]">
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-[color:var(--border-subtle)] pt-5 text-[12px] text-[color:var(--text-muted)]">
              <Target className="h-4 w-4 shrink-0 text-[color:var(--text-accent)]" />
              <span>Insights update automatically as your tracker changes.</span>
            </div>
          </aside>
        </div>
      )}
    </motion.div>
  );
}
