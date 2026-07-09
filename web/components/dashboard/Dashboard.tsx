"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  SendHorizonal,
  Users,
  FileText,
  Sparkles,
  Radar,
  Loader2,
  Inbox,
  ScrollText,
  Mail,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Circle,
  X,
  Columns3,
  Settings as SettingsIcon,
  RefreshCw,
} from "lucide-react";
import { StatCards } from "./StatCards";
import { TodayView } from "./TodayView";
import { PatternsView } from "./PatternsView";
import { JobsBrowser } from "./JobsBrowser";
import { Applications } from "./Applications";
import { Referrals } from "./Referrals";
import { ReportsView } from "./ReportsView";
import { AiStudio } from "./AiStudio";
import { PipelineManager } from "./PipelineManager";
import { PipelineBoard } from "./PipelineBoard";
import { SettingsView } from "./SettingsView";
import { Outreach } from "./Outreach";
import { AppShell, type NavSection } from "./AppShell";
import { type Command } from "./CommandPalette";
import { UserMenu } from "@/components/auth/UserMenu";
import { ResumesLibrary } from "./ResumesLibrary";
import type {
  Application,
  Job,
  ReportMeta,
  Referral,
  Summary,
} from "@/lib/types";

type ScanStatus = "pending" | "running" | "done" | "error";
interface ScanEntry {
  id: string;
  label: string;
  status: ScanStatus;
  new: number | null;
}

const SCAN_SOURCES: Pick<ScanEntry, "id" | "label">[] = [
  { id: "ats",       label: "ATS portals (Greenhouse/Ashby/Lever)" },
  { id: "jobspy",    label: "LinkedIn & Indeed" },
  { id: "remote",    label: "Remote boards (WWR/Remotive/RemoteOK)" },
  { id: "instahyre", label: "Instahyre" },
  { id: "hn",        label: "HN: Who is Hiring" },
  { id: "adzuna",    label: "Adzuna" },
];

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

const ICON = "h-[18px] w-[18px]";

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReferrals = useCallback(async () => {
    const r = await getJSON<{ referrals: Referral[] }>("/api/referrals");
    setReferrals(r.referrals);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, j, a, rep, ref] = await Promise.all([
        getJSON<Summary>("/api/summary"),
        getJSON<{ jobs: Job[] }>("/api/jobs"),
        getJSON<{ applications: Application[] }>("/api/applications"),
        getJSON<{ reports: ReportMeta[] }>("/api/reports"),
        getJSON<{ referrals: Referral[] }>("/api/referrals"),
      ]);
      setSummary(s);
      setJobs(j.jobs);
      setApps(a.applications);
      setReports(rep.reports);
      setReferrals(ref.referrals);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshSummary = useCallback(async () => {
    const s = await getJSON<Summary>("/api/summary");
    setSummary(s);
  }, []);

  const [tab, setTab] = useState("overview");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanLog, setScanLog] = useState<ScanEntry[]>([]);
  const [scanDone, setScanDone] = useState(false);

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setScanDone(false);
    setScanMsg(null);
    setScanLog(SCAN_SOURCES.map((s) => ({ ...s, status: "pending", new: null })));

    try {
      const res = await fetch("/api/scan", { method: "POST" });
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "running") {
              setScanLog((prev) =>
                prev.map((s) => (s.id === event.id ? { ...s, status: "running" } : s))
              );
            } else if (event.type === "done") {
              setScanLog((prev) =>
                prev.map((s) =>
                  s.id === event.id
                    ? { ...s, status: event.ok ? "done" : "error", new: event.new }
                    : s
                )
              );
            } else if (event.type === "complete") {
              setScanMsg(event.summary);
              setScanDone(true);
              await loadAll();
            } else if (event.type === "error") {
              setScanMsg(event.message ?? "Scan error");
              setScanDone(true);
            }
          } catch {
            /* ignore malformed event */
          }
        }
      }
    } catch (e) {
      setScanMsg((e as Error).message);
      setScanDone(true);
    } finally {
      setScanning(false);
    }
  }, [scanning, loadAll]);

  const sections: NavSection[] = useMemo(
    () => [
      {
        items: [{ id: "overview", label: "Today", icon: <LayoutDashboard className={ICON} /> }],
      },
      {
        title: "Search",
        items: [
          { id: "jobs", label: "Discover", icon: <Search className={ICON} />, badge: jobs.length },
          { id: "pipeline-board", label: "Pipeline", icon: <Columns3 className={ICON} /> },
          { id: "reports", label: "Reports", icon: <FileText className={ICON} />, badge: reports.length },
          { id: "patterns", label: "Rejection intel", icon: <TrendingDown className={ICON} /> },
        ],
      },
      {
        title: "Network",
        items: [
          { id: "referrals", label: "Referrals", icon: <Users className={ICON} />, badge: referrals.length },
          { id: "outreach", label: "Outreach", icon: <Mail className={ICON} /> },
        ],
      },
      {
        title: "Studio",
        items: [
          { id: "resumes", label: "Resumes", icon: <ScrollText className={ICON} /> },
          { id: "ai", label: "AI Studio", icon: <Sparkles className={ICON} /> },
        ],
      },
      {
        title: "Manage",
        items: [
          { id: "applications", label: "Applications", icon: <SendHorizonal className={ICON} />, badge: apps.length },
          { id: "pipeline", label: "Inbox", icon: <Inbox className={ICON} /> },
          { id: "settings", label: "Settings", icon: <SettingsIcon className={ICON} /> },
        ],
      },
    ],
    [jobs.length, reports.length, referrals.length, apps.length]
  );

  const commands: Command[] = useMemo(
    () => [
      { id: "go-overview", group: "Navigate", label: "Today", icon: <LayoutDashboard className="h-4 w-4" />, run: () => setTab("overview") },
      { id: "go-jobs", group: "Navigate", label: "Discover", hint: `${jobs.length}`, icon: <Search className="h-4 w-4" />, run: () => setTab("jobs") },
      { id: "go-pipeline-board", group: "Navigate", label: "Pipeline", icon: <Columns3 className="h-4 w-4" />, run: () => setTab("pipeline-board") },
      { id: "go-apps", group: "Navigate", label: "Applications", hint: `${apps.length}`, icon: <SendHorizonal className="h-4 w-4" />, run: () => setTab("applications") },
      { id: "go-ref", group: "Navigate", label: "Referrals", icon: <Users className="h-4 w-4" />, run: () => setTab("referrals") },
      { id: "go-rep", group: "Navigate", label: "Reports", hint: `${reports.length}`, icon: <FileText className="h-4 w-4" />, run: () => setTab("reports") },
      { id: "go-patterns", group: "Navigate", label: "Rejection intelligence", icon: <TrendingDown className="h-4 w-4" />, run: () => setTab("patterns") },
      { id: "go-resumes", group: "Navigate", label: "Resumes", icon: <ScrollText className="h-4 w-4" />, run: () => setTab("resumes") },
      { id: "go-inbox", group: "Navigate", label: "Inbox", icon: <Inbox className="h-4 w-4" />, run: () => setTab("pipeline") },
      { id: "go-ai", group: "Navigate", label: "AI Studio", icon: <Sparkles className="h-4 w-4" />, run: () => setTab("ai") },
      { id: "go-outreach", group: "Navigate", label: "Outreach", icon: <Mail className="h-4 w-4" />, run: () => setTab("outreach") },
      { id: "go-settings", group: "Navigate", label: "Settings", icon: <SettingsIcon className="h-4 w-4" />, run: () => setTab("settings") },
      { id: "act-scan", group: "Actions", label: "Scan job portals now", hint: "zero-cost", icon: <Radar className="h-4 w-4" />, run: runScan },
      { id: "act-eval", group: "Actions", label: "Evaluate a job (paste JD)", icon: <Sparkles className="h-4 w-4" />, run: () => setTab("ai") },
      { id: "act-refresh", group: "Actions", label: "Refresh all data", icon: <RefreshCw className="h-4 w-4" />, run: () => loadAll() },
    ],
    [jobs.length, apps.length, reports.length, runScan, loadAll]
  );

  const scanLogPanel = (
    <AnimatePresence>
      {scanLog.length > 0 && (
        <motion.div
          key="scan-log"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)]"
        >
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <Radar className="h-4 w-4 text-[color:var(--amber)]" />
                Full scan
              </span>
              {!scanning && (
                <button
                  onClick={() => setScanLog([])}
                  className="rounded p-0.5 text-[color:var(--t3)] hover:text-[color:var(--t1)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {scanLog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs">
                  {entry.status === "running" ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[color:var(--amber)]" />
                  ) : entry.status === "done" ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-[color:var(--green)]" />
                  ) : entry.status === "error" ? (
                    <XCircle className="h-3 w-3 shrink-0 text-[color:var(--red)]" />
                  ) : (
                    <Circle className="h-3 w-3 shrink-0 text-[color:var(--t3)]" />
                  )}
                  <span className="flex-1 text-[color:var(--t2)]">{entry.label}</span>
                  {entry.new !== null && (
                    <span
                      className={
                        entry.new > 0 ? "font-medium text-[color:var(--green)]" : "text-[color:var(--t3)]"
                      }
                    >
                      {entry.new > 0 ? `+${entry.new}` : "0 new"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {scanDone && scanMsg && (
              <div className="mt-2 border-t border-[color:var(--rule)] pt-2 text-xs font-medium">
                {scanMsg}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  function renderTab() {
    switch (tab) {
      case "overview":
        return (
          <TodayView
            summary={summary}
            jobs={jobs}
            apps={apps}
            reports={reports}
            loading={loading}
            scanning={scanning}
            onScan={runScan}
            onNavigate={setTab}
          />
        );
      case "jobs":
        return (
          <JobsBrowser
            jobs={jobs}
            loading={loading}
            referrals={referrals}
            apps={apps}
            reports={reports}
            onReferralChange={loadReferrals}
            onSaved={loadAll}
            onJobDelete={loadAll}
          />
        );
      case "pipeline-board":
        return <PipelineBoard apps={apps} loading={loading} onChange={loadAll} onNavigate={setTab} />;
      case "applications":
        return <Applications apps={apps} loading={loading} onChange={loadAll} />;
      case "referrals":
        return (
          <Referrals
            referrals={referrals}
            loading={loading}
            jobs={jobs}
            reports={reports}
            onChange={async () => {
              await loadReferrals();
              await refreshSummary();
            }}
          />
        );
      case "reports":
        return <ReportsView reports={reports} loading={loading} />;
      case "patterns":
        return <PatternsView apps={apps} reports={reports} summary={summary} loading={loading} />;
      case "resumes":
        return <ResumesLibrary />;
      case "pipeline":
        return <PipelineManager onSaved={loadAll} />;
      case "ai":
        return <AiStudio onSaved={loadAll} />;
      case "outreach":
        return <Outreach />;
      case "settings":
        return <SettingsView summary={summary} />;
      default:
        return null;
    }
  }

  // StatCards are the "cockpit" strip — useful context on the data-heavy tabs,
  // but noise on the editorial Today / Pipeline / Settings pages.
  const showStatCards = !["overview", "pipeline-board", "settings", "patterns"].includes(tab);

  return (
    <AppShell
      sections={sections}
      active={tab}
      onSelect={setTab}
      commands={commands}
      onScan={runScan}
      scanning={scanning}
      onEvaluate={() => setTab("ai")}
      user={<UserMenu />}
    >
      {scanLogPanel}
      {showStatCards && (
        <div className="mb-6">
          <StatCards summary={summary} loading={loading} />
        </div>
      )}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {renderTab()}
      </motion.div>

      <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-[color:var(--rule)] pt-4 text-center text-[11px] text-[color:var(--t3)]">
        <span>Live view of data/applications.md · data/pipeline.md · reports/</span>
      </footer>
    </AppShell>
  );
}
