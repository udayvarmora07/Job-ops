"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  SendHorizonal,
  Users,
  FileText,
  RefreshCw,
  Sparkles,
  Radar,
  Loader2,
  Inbox,
  ScrollText,
  Mail,
  CheckCircle2,
  XCircle,
  Circle,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatCards } from "./StatCards";
import { Overview } from "./Overview";
import { JobsBrowser } from "./JobsBrowser";
import { Applications } from "./Applications";
import { Referrals } from "./Referrals";
import { ReportsView } from "./ReportsView";
import { AiStudio } from "./AiStudio";
import { PipelineManager } from "./PipelineManager";
import { Outreach } from "./Outreach";
import { CommandPalette, type Command } from "./CommandPalette";
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

  const commands: Command[] = useMemo(
    () => [
      { id: "go-overview", group: "Navigate", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, run: () => setTab("overview") },
      { id: "go-jobs", group: "Navigate", label: "Jobs", hint: `${jobs.length}`, icon: <Search className="h-4 w-4" />, run: () => setTab("jobs") },
      { id: "go-apps", group: "Navigate", label: "Applications", hint: `${apps.length}`, icon: <SendHorizonal className="h-4 w-4" />, run: () => setTab("applications") },
      { id: "go-ref", group: "Navigate", label: "Referrals", icon: <Users className="h-4 w-4" />, run: () => setTab("referrals") },
      { id: "go-rep", group: "Navigate", label: "Reports", hint: `${reports.length}`, icon: <FileText className="h-4 w-4" />, run: () => setTab("reports") },
      { id: "go-resumes", group: "Navigate", label: "Resumes", icon: <ScrollText className="h-4 w-4" />, run: () => setTab("resumes") },
      { id: "go-pipeline", group: "Navigate", label: "Pipeline", icon: <Inbox className="h-4 w-4" />, run: () => setTab("pipeline") },
      { id: "go-ai", group: "Navigate", label: "AI Studio", icon: <Sparkles className="h-4 w-4" />, run: () => setTab("ai") },
      { id: "go-outreach", group: "Navigate", label: "Outreach", icon: <Mail className="h-4 w-4" />, run: () => setTab("outreach") },
      { id: "act-scan", group: "Actions", label: "Scan job portals now", hint: "zero-cost", icon: <Radar className="h-4 w-4" />, run: runScan },
      { id: "act-eval", group: "Actions", label: "Evaluate a job (paste JD)", icon: <Sparkles className="h-4 w-4" />, run: () => setTab("ai") },
      { id: "act-refresh", group: "Actions", label: "Refresh all data", icon: <RefreshCw className="h-4 w-4" />, run: () => loadAll() },
    ],
    [jobs.length, apps.length, reports.length, runScan, loadAll]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Jobops
              </h1>
              <p className="text-xs text-muted-foreground">
                Job search command center
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette commands={commands} />
            <Button variant="default" size="sm" onClick={runScan} disabled={scanning} title="Scan all job sources">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
              {scanning ? "Scanning…" : "Scan All"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </header>

        <AnimatePresence>
          {scanLog.length > 0 && (
            <motion.div
              key="scan-log"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-lg border bg-card shadow-sm"
            >
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Radar className="h-4 w-4 text-primary" />
                    Full Scan
                  </span>
                  {!scanning && (
                    <button
                      onClick={() => setScanLog([])}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {scanLog.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 text-xs">
                      {entry.status === "running" ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                      ) : entry.status === "done" ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                      ) : entry.status === "error" ? (
                        <XCircle className="h-3 w-3 shrink-0 text-destructive" />
                      ) : (
                        <Circle className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                      )}
                      <span className="flex-1 text-muted-foreground">{entry.label}</span>
                      {entry.new !== null && (
                        <span
                          className={
                            entry.new > 0
                              ? "font-medium text-green-600 dark:text-green-400"
                              : "text-muted-foreground"
                          }
                        >
                          {entry.new > 0 ? `+${entry.new}` : "0 new"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {scanDone && scanMsg && (
                  <div className="mt-2 border-t pt-2 text-xs font-medium">{scanMsg}</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <StatCards summary={summary} loading={loading} />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mt-6"
        >
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="overview">
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="jobs">
                <Search className="h-4 w-4" />
                Jobs
                <span className="font-num ml-1 text-xs opacity-70">
                  {jobs.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="applications">
                <SendHorizonal className="h-4 w-4" />
                Applications
                <span className="font-num ml-1 text-xs opacity-70">
                  {apps.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="referrals">
                <Users className="h-4 w-4" />
                Referrals
                <span className="font-num ml-1 text-xs opacity-70">
                  {referrals.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="reports">
                <FileText className="h-4 w-4" />
                Reports
                <span className="font-num ml-1 text-xs opacity-70">
                  {reports.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="resumes">
                <ScrollText className="h-4 w-4" />
                Resumes
              </TabsTrigger>
              <TabsTrigger value="pipeline">
                <Inbox className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-4 w-4" />
                AI Studio
              </TabsTrigger>
              <TabsTrigger value="outreach">
                <Mail className="h-4 w-4" />
                Outreach
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Overview summary={summary} loading={loading} />
            </TabsContent>
            <TabsContent value="jobs">
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
            </TabsContent>
            <TabsContent value="applications">
              <Applications apps={apps} loading={loading} onChange={loadAll} />
            </TabsContent>
            <TabsContent value="referrals">
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
            </TabsContent>
            <TabsContent value="reports">
              <ReportsView reports={reports} loading={loading} />
            </TabsContent>
            <TabsContent value="resumes">
              <ResumesLibrary />
            </TabsContent>
            <TabsContent value="pipeline">
              <PipelineManager onSaved={loadAll} />
            </TabsContent>
            <TabsContent value="ai">
              <AiStudio onSaved={loadAll} />
            </TabsContent>
            <TabsContent value="outreach">
              <Outreach />
            </TabsContent>
          </Tabs>
        </motion.div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Live view of data/applications.md · data/pipeline.md ·
          data/scan-history.tsv · reports/ · data/referrals.json
        </footer>
      </div>
    </div>
  );
}
