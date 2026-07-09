"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import type { Application, Job, ReportMeta, Summary } from "@/lib/types";

/* Shared keyboard-focus ring — reused on every interactive element so the
   page is fully operable and visibly focusable for keyboard users. */
const focusRing =
  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--fill-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-1)]";

/* ————————————————————————————————————————————————————————————————
   TodayView — Meridian "Calm Intelligence" editorial layout.

   Concept-a's 2-column brief, rebuilt under the Meridian type rules:
   weight capped at 500, score at 32px, sentence case, no ALL-CAPS.
   Company name earns hierarchy through size, not colour — amber is
   reserved for the score (achievement), per the CDS colour roles.

   Pure visual layer: every number is derived from the existing
   summary / jobs / apps / reports hooks. No new fetching.
———————————————————————————————————————————————————————————————— */

interface TodayViewProps {
  summary: Summary | null;
  jobs: Job[];
  apps: Application[];
  reports: ReportMeta[];
  loading: boolean;
  userName?: string;
  scanning: boolean;
  onScan: () => void;
  onNavigate: (tab: string) => void;
}

type BriefKind = "overdue" | "interview" | "responded" | "evaluate";
interface BriefItem {
  key: string;
  kind: BriefKind;
  title: string;
  sub: string;
  tab: string;
}

const DAY = 86_400_000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

function scoreLabel(n: number): string {
  if (n >= 4.5) return "Exceptional match";
  if (n >= 4.0) return "Strong match";
  if (n >= 3.0) return "Worth a look";
  return "A stretch";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Verification state derived from a report's legitimacy tier. */
function ghostShield(legitimacy: string | null): {
  status: "verified" | "suspicious" | "closed";
  label: string;
} {
  const t = (legitimacy ?? "").toLowerCase();
  if (!t) return { status: "suspicious", label: "Not yet verified" };
  if (/(closed|expired|dead|ghost)/.test(t)) return { status: "closed", label: legitimacy! };
  if (/(suspicious|caution|unconfirmed|unclear)/.test(t))
    return { status: "suspicious", label: legitimacy! };
  return { status: "verified", label: legitimacy! };
}

export function TodayView({
  summary,
  jobs,
  apps,
  reports,
  loading,
  userName,
  scanning,
  onScan,
  onNavigate,
}: TodayViewProps) {
  /* ——— Hero: highest-scoring evaluated role ——— */
  const topPick = useMemo(() => {
    const scored = reports
      .filter((r) => typeof r.scoreNum === "number")
      .sort((a, b) => (b.scoreNum ?? 0) - (a.scoreNum ?? 0));
    return scored[0] ?? null;
  }, [reports]);

  const heroInsight = useMemo(() => {
    if (!topPick || topPick.scoreNum == null) return null;
    const n = topPick.scoreNum;
    const arch = topPick.archetype ? ` for your ${topPick.archetype.toLowerCase()} track` : "";
    const verdict =
      n >= 4.5
        ? "This is a rare, high-conviction fit — worth a fully tailored application."
        : n >= 4.0
          ? "A strong fit that rewards a tailored CV and a considered cover note."
          : "A reasonable fit — apply if the mission or team pulls you in.";
    return `${topPick.company} scored ${n.toFixed(1)} out of 5${arch}. ${verdict}`;
  }, [topPick]);

  /* ——— Today's brief: prioritised, data-derived actions ——— */
  const brief = useMemo<BriefItem[]>(() => {
    const items: BriefItem[] = [];

    // Overdue follow-ups — Applied with no response for 5+ days.
    for (const a of apps) {
      if (a.status !== "Applied") continue;
      const d = daysSince(a.date);
      if (d != null && d >= 5) {
        items.push({
          key: `fu-${a.num}`,
          kind: "overdue",
          title: `Follow up with ${a.company}`,
          sub: `Day ${d} · no response · overdue`,
          tab: "applications",
        });
      }
    }

    // Live interviews.
    for (const a of apps) {
      if (a.status !== "Interview") continue;
      items.push({
        key: `iv-${a.num}`,
        kind: "interview",
        title: `Interview prep: ${a.company}`,
        sub: a.role || "In interview process",
        tab: "applications",
      });
    }

    // Companies that replied and are waiting on you.
    for (const a of apps) {
      if (a.status !== "Responded") continue;
      items.push({
        key: `rs-${a.num}`,
        kind: "responded",
        title: `Reply to ${a.company}`,
        sub: `${a.role || "Responded"} · awaiting your move`,
        tab: "applications",
      });
    }

    // New arrivals to evaluate.
    const arrivals = jobs.filter((j) => j.inPipeline && !j.processed);
    if (arrivals.length > 0) {
      const names = arrivals
        .slice(0, 3)
        .map((j) => j.company)
        .filter(Boolean)
        .join(" · ");
      items.push({
        key: "eval-new",
        kind: "evaluate",
        title: `Evaluate ${arrivals.length} new arrival${arrivals.length > 1 ? "s" : ""}`,
        sub: names || "Fresh from the last scan",
        tab: "pipeline",
      });
    }

    return items.slice(0, 4);
  }, [apps, jobs]);

  /* ——— Pipeline pulse ——— */
  const pipeline = useMemo(() => {
    const by = summary?.byStatus ?? {};
    const toEvaluate =
      summary?.counts.inPipeline ?? jobs.filter((j) => j.inPipeline && !j.processed).length;
    return [
      { label: "To evaluate", n: toEvaluate },
      { label: "Applied", n: by["Applied"] ?? 0 },
      { label: "Interviewing", n: by["Interview"] ?? 0 },
      { label: "Offers", n: by["Offer"] ?? 0 },
    ];
  }, [summary, jobs]);

  /* ——— 30-day numbers ——— */
  const stats = useMemo(() => {
    const by = summary?.byStatus ?? {};
    const sent = ["Applied", "Responded", "Interview", "Offer", "Rejected"].reduce(
      (acc, s) => acc + (by[s] ?? 0),
      0
    );
    return [
      { label: "Roles evaluated", value: String(summary?.counts.evaluated ?? 0) },
      { label: "Applications sent", value: String(sent) },
      {
        label: "Average score",
        value: summary?.avgScore != null ? summary.avgScore.toFixed(1) : "—",
      },
      {
        label: "Response rate",
        value: summary?.rates.response != null ? `${Math.round(summary.rates.response)}%` : "—",
      },
    ];
  }, [summary]);

  /* ——— Recent wins: positive reinforcement for a hard process ——— */
  const wins = useMemo(() => {
    const rank: Record<string, number> = { Offer: 3, Interview: 2, Responded: 1 };
    return apps
      .filter((a) => a.status in rank)
      .sort((x, y) => {
        const byDate = Date.parse(y.date) - Date.parse(x.date);
        return Number.isNaN(byDate) ? rank[y.status] - rank[x.status] : byDate;
      })
      .slice(0, 3)
      .map((a) => ({
        key: a.num,
        label:
          a.status === "Offer"
            ? `Offer from ${a.company}`
            : a.status === "Interview"
              ? `${a.company} — in interviews`
              : `${a.company} replied`,
      }));
  }, [apps]);

  const heroActions = topPick
    ? [
        {
          label: "Read full evaluation",
          hint: topPick.date ?? undefined,
          onClick: () => onNavigate("reports"),
        },
        { label: "Tailor CV for this role", onClick: () => onNavigate("resumes") },
        { label: "Deep company research", onClick: () => onNavigate("ai") },
        { label: "Draft outreach", onClick: () => onNavigate("outreach") },
      ]
    : [];

  const shield = topPick ? ghostShield(topPick.legitimacy) : null;
  const reduce = useReducedMotion();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-[1180px]"
    >
      {/* Date bar */}
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-[color:var(--text-muted)]">
        <span className="text-[color:var(--text-secondary)]">{dateStr}</span>
        <span>
          {greeting()}
          {userName ? (
            <>
              , <span className="text-[color:var(--text-secondary)]">{userName}</span>
            </>
          ) : null}
        </span>
        {brief.length > 0 && (
          <span>
            {brief.length} action{brief.length > 1 ? "s" : ""} waiting
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ————————————————— LEFT: the featured opportunity ————————————————— */}
        <section className="lg:border-r lg:border-[color:var(--border-subtle)] lg:pr-14">
          <div className="mb-6 text-[13px] text-[color:var(--text-muted)]">
            {topPick ? (
              <>
                Top pick
                {topPick.archetype ? (
                  <span className="text-[color:var(--text-secondary)]"> · {topPick.archetype}</span>
                ) : null}
              </>
            ) : (
              "Today's focus"
            )}
          </div>

          {topPick ? (
            <>
              <div className="flex items-start justify-between gap-6">
                <h2
                  className="break-words font-medium tracking-[-0.02em] text-[color:var(--text-primary)]"
                  style={{ fontSize: "clamp(32px, 6vw, 44px)", lineHeight: 1.02 }}
                >
                  {topPick.company}
                </h2>
                <div className="shrink-0 pt-1 text-right">
                  <div
                    className="font-medium tabular-nums text-[color:var(--text-warning)]"
                    style={{ fontSize: "32px", lineHeight: 1 }}
                  >
                    {topPick.scoreNum?.toFixed(1)}
                    <span className="text-[16px] text-[color:var(--text-muted)]">/5</span>
                  </div>
                  {topPick.scoreNum != null && (
                    <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">
                      {scoreLabel(topPick.scoreNum)}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="mt-4 max-w-xl text-[22px] font-normal leading-snug text-[color:var(--text-primary)]">
                {topPick.role}
              </h3>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[color:var(--text-muted)]">
                {topPick.location && (
                  <span className="text-[color:var(--text-secondary)]">{topPick.location}</span>
                )}
                {topPick.archetype && <span>{topPick.archetype}</span>}
              </div>

              <hr className="my-7 border-[color:var(--border-subtle)]" />

              {heroInsight && (
                <p className="max-w-xl text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
                  {heroInsight}
                </p>
              )}

              {/* Action links — text with arrows, no button chrome */}
              <div className="mt-7 max-w-xl">
                {heroActions.map((a, i) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className={`group flex w-full items-center justify-between gap-3 rounded-sm border-b border-[color:var(--border-subtle)] py-3 text-left text-[14px] font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] ${focusRing} ${
                      i === 0 ? "border-t" : ""
                    }`}
                  >
                    <span>{a.label}</span>
                    <span className="flex items-center gap-3">
                      {a.hint && (
                        <span className="text-[11px] font-normal text-[color:var(--text-muted)]">
                          {a.hint}
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--text-accent)]" />
                    </span>
                  </button>
                ))}
              </div>

              {/* Ghost Shield */}
              {shield && (
                <div className="mt-7 flex items-center gap-2 text-[12px] text-[color:var(--text-muted)]">
                  {shield.status === "verified" ? (
                    <ShieldCheck className="h-4 w-4 text-[color:var(--text-success)]" />
                  ) : shield.status === "closed" ? (
                    <ShieldX className="h-4 w-4 text-[color:var(--text-danger)]" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-[color:var(--text-warning)]" />
                  )}
                  <span className="text-[color:var(--text-secondary)]">Ghost Shield</span>
                  <span>· {shield.label}</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-8 py-16 text-center">
              <h2 className="text-[22px] font-medium text-[color:var(--text-primary)]">
                {loading ? "Loading your brief…" : "No evaluations yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[14px] text-[color:var(--text-muted)]">
                {loading
                  ? "Reading applications, reports and the scan history."
                  : "Scan the portals or paste a job to get your first scored top pick here."}
              </p>
              {!loading && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={onScan}
                    disabled={scanning}
                    className={`rounded-md bg-[color:var(--fill-accent)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                  >
                    {scanning ? "Scanning…" : "Scan portals"}
                  </button>
                  <button
                    onClick={() => onNavigate("ai")}
                    className={`rounded-md border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] ${focusRing}`}
                  >
                    Evaluate a job
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ————————————————— RIGHT: the brief ————————————————— */}
        <aside className="flex flex-col gap-9">
          {/* Today's brief */}
          <div>
            <div className="mb-4 text-[11px] font-medium tracking-wide text-[color:var(--text-muted)]">
              Today's brief
            </div>
            {brief.length > 0 ? (
              <div>
                {brief.map((item, i) => (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.tab)}
                    className={`group grid w-full grid-cols-[20px_1fr_16px] items-center gap-3 rounded-sm border-b border-[color:var(--border-subtle)] py-3.5 text-left ${focusRing} ${
                      i === 0 ? "border-t" : ""
                    }`}
                  >
                    <span
                      className={`self-start pt-0.5 text-[11px] font-medium tabular-nums ${
                        item.kind === "overdue"
                          ? "text-[color:var(--text-danger)]"
                          : "text-[color:var(--text-muted)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span
                        className={`block text-[13px] font-medium ${
                          item.kind === "overdue"
                            ? "text-[color:var(--text-danger)]"
                            : "text-[color:var(--text-primary)]"
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[color:var(--text-muted)]">
                        {item.sub}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[color:var(--text-muted)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[color:var(--text-muted)]">
                {loading ? "Reading your pipeline…" : "You're all caught up. Nothing needs you right now."}
              </p>
            )}
          </div>

          {/* Pipeline pulse */}
          <div>
            <div className="mb-3 text-[11px] font-medium tracking-wide text-[color:var(--text-muted)]">
              Pipeline
            </div>
            <div>
              {pipeline.map((row, i) => (
                <button
                  key={row.label}
                  onClick={() =>
                    onNavigate(row.label === "To evaluate" ? "pipeline" : "applications")
                  }
                  className={`group flex w-full items-baseline justify-between rounded-sm border-b border-[color:var(--border-subtle)] py-2 text-left ${focusRing} ${
                    i === 0 ? "border-t" : ""
                  }`}
                >
                  <span className="text-[13px] text-[color:var(--text-secondary)] transition-colors group-hover:text-[color:var(--text-primary)]">
                    {row.label}
                  </span>
                  <span
                    className={`text-[18px] font-medium tabular-nums ${
                      row.n === 0
                        ? "text-[color:var(--text-muted)]"
                        : "text-[color:var(--text-primary)]"
                    }`}
                  >
                    {row.n}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 30-day numbers */}
          <div>
            <div className="mb-3 text-[11px] font-medium tracking-wide text-[color:var(--text-muted)]">
              All-time numbers
            </div>
            <div className="flex flex-col gap-2">
              {stats.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between text-[13px]">
                  <span className="text-[color:var(--text-secondary)]">{s.label}</span>
                  <span className="font-medium tabular-nums text-[color:var(--text-primary)]">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent wins — momentum */}
          {wins.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-medium tracking-wide text-[color:var(--text-muted)]">
                Recent wins
              </div>
              <div className="flex flex-col gap-2.5">
                {wins.map((w) => (
                  <div key={w.key} className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--text-success)]" />
                    <span className="text-[color:var(--text-secondary)]">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scan block */}
          <div className="border-t border-[color:var(--border-subtle)] pt-5">
            <p className="mb-2.5 text-[12px] leading-relaxed text-[color:var(--text-muted)]">
              {summary?.counts.fetchedJobs ?? 0} jobs tracked ·{" "}
              <span className="text-[color:var(--text-secondary)]">
                {summary?.counts.inPipeline ?? 0} waiting
              </span>{" "}
              in the inbox
            </p>
            <button
              onClick={onScan}
              disabled={scanning}
              className={`inline-flex items-center gap-1 rounded-sm text-[12px] font-medium text-[color:var(--text-accent)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
            >
              {scanning ? "Scanning portals…" : "Run scan now"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
