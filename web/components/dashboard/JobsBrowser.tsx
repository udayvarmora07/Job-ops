"use client";

import { useMemo, useState } from "react";
import { ExternalLink, UserPlus, Check, Plus, Loader2, Trash2 } from "lucide-react";
import { expBucket, type ExpBucket } from "@/lib/experience";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JobDetailDialog } from "./JobDetailDialog";
import type { Job, Referral, Application, ReportMeta } from "@/lib/types";

const PAGE = 50;

// Colour-coded badge: green = fits Uday (≤3 yr), amber = stretch (3–6 yr),
// muted = over-range (6+ yr), grey = unknown.
function ExpBadge({ exp, minYears }: { exp: string | null; minYears: number | null }) {
  if (!exp || minYears === null) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  const colour =
    minYears < 3
      ? "bg-emerald-500/15 text-emerald-400"
      : minYears < 6
      ? "bg-amber-500/15 text-amber-400"
      : "bg-slate-500/15 text-slate-400";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 font-num text-[11px] font-medium ${colour}`}>
      {exp}
    </span>
  );
}

export function JobsBrowser({
  jobs,
  loading,
  referrals,
  apps,
  reports,
  onReferralChange,
  onSaved,
  onJobDelete,
}: {
  jobs: Job[];
  loading: boolean;
  referrals: Referral[];
  apps: Application[];
  reports: ReportMeta[];
  onReferralChange: () => Promise<void>;
  onSaved?: () => Promise<void>;
  onJobDelete?: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [portal, setPortal] = useState("all");
  const [state, setState] = useState("all");
  const [expFilter, setExpFilter] = useState<"all" | ExpBucket>("all");
  const [limit, setLimit] = useState(PAGE);
  const [asking, setAsking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Job | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Quick "add URL" inline form
  const [addUrl, setAddUrl] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [addUrlMsg, setAddUrlMsg] = useState<string | null>(null);

  function openDetail(j: Job) {
    setSelected(j);
    setDetailOpen(true);
  }

  const portals = useMemo(
    () =>
      Array.from(new Set(jobs.map((j) => j.portal).filter(Boolean))) as string[],
    [jobs]
  );
  const referredUrls = useMemo(
    () => new Set(referrals.map((r) => r.jobUrl).filter(Boolean)),
    [referrals]
  );

  const appliedKeys = useMemo(
    () =>
      new Set(
        apps
          .filter((a) => a.status === "Applied")
          .map((a) => `${a.company.toLowerCase()}::${(a.role || "").toLowerCase()}`)
      ),
    [apps]
  );

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return jobs.filter((j) => {
      if (appliedKeys.has(`${j.company.toLowerCase()}::${j.role.toLowerCase()}`)) return false;
      if (portal !== "all" && j.portal !== portal) return false;
      if (state === "pending" && (j.processed || !j.inPipeline)) return false;
      if (state === "processed" && !j.processed) return false;
      if (state === "inbox" && !j.inPipeline) return false;
      if (expFilter !== "all") {
        const b = expBucket(j.expMinYears !== null ? { display: j.expRequired ?? "", minYears: j.expMinYears, maxYears: null, source: "explicit" } : null);
        if (b !== expFilter) return false;
      }
      if (!term) return true;
      return (
        j.company.toLowerCase().includes(term) ||
        j.role.toLowerCase().includes(term) ||
        j.url.toLowerCase().includes(term) ||
        (j.location || "").toLowerCase().includes(term)
      );
    });
  }, [jobs, q, portal, state, expFilter]);

  async function deleteJob(j: Job) {
    setDeleting((prev) => new Set(prev).add(j.url));
    try {
      await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: j.url }),
      });
      await onJobDelete?.();
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(j.url); return s; });
    }
  }

  async function askReferral(j: Job) {
    setAsking(j.url);
    try {
      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: j.company,
          role: j.role,
          jobUrl: j.url,
          channel: "LinkedIn",
          status: "to_ask",
        }),
      });
      await onReferralChange();
    } finally {
      setAsking(null);
    }
  }

  async function submitAddUrl() {
    const url = addUrl.trim();
    if (!url) return;
    setAddingUrl(true);
    setAddUrlMsg(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddUrlMsg(`Error: ${data.error}`);
        return;
      }
      setAddUrl("");
      setAddUrlMsg(data.duplicate ? "Already in pipeline." : "Added to pipeline.");
      setTimeout(() => setAddUrlMsg(null), 3000);
      await onSaved?.();
    } catch (e) {
      setAddUrlMsg((e as Error).message);
    } finally {
      setAddingUrl(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;

  return (
    <Card className="overflow-hidden">
      {/* Toolbar row 1: search + filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Input
          placeholder="Search company, role, location…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          className="max-w-xs"
        />
        <Select
          value={portal}
          onChange={(e) => setPortal(e.target.value)}
          aria-label="Filter by portal"
        >
          <option value="all">All portals</option>
          {portals.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          value={state}
          onChange={(e) => setState(e.target.value)}
          aria-label="Filter by state"
        >
          <option value="all">All states</option>
          <option value="inbox">In inbox</option>
          <option value="pending">Pending eval</option>
          <option value="processed">Processed</option>
        </Select>
        <Select
          value={expFilter}
          onChange={(e) => { setExpFilter(e.target.value as "all" | ExpBucket); setLimit(PAGE); }}
          aria-label="Filter by experience"
        >
          <option value="all">All exp</option>
          <option value="entry">Entry (0–3 yr)</option>
          <option value="mid">Mid (3–6 yr)</option>
          <option value="senior">Senior (6+ yr)</option>
          <option value="unknown">Exp unknown</option>
        </Select>
        <span className="font-num ml-auto text-xs text-muted-foreground">
          {filtered.length} of {jobs.length}
        </span>
      </div>

      {/* Toolbar row 2: quick add URL */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/20 px-3 py-2">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          placeholder="Paste a job URL to add to pipeline…"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAddUrl()}
          className="h-7 max-w-sm text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={submitAddUrl}
          disabled={addingUrl || !addUrl.trim()}
          className="h-7 px-3 text-xs"
        >
          {addingUrl ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {addingUrl ? "Adding…" : "Add to pipeline"}
        </Button>
        {addUrlMsg && (
          <span className="text-xs text-muted-foreground">{addUrlMsg}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Exp</th>
              <th className="px-3 py-2 font-medium">Portal</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Seen</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((j) => (
              <tr
                key={j.url}
                onClick={() => openDetail(j)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/40"
              >
                <td className="px-3 py-2 font-medium">
                  <span className="text-primary hover:underline">{j.company}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{j.role || "—"}</td>
                <td className="px-3 py-2">
                  <ExpBadge exp={j.expRequired} minYears={j.expMinYears} />
                </td>
                <td className="px-3 py-2">
                  {j.portal ? (
                    <Badge variant="outline">{j.portal.replace("-api", "")}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">inbox</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {j.location || "—"}
                </td>
                <td className="font-num px-3 py-2 text-xs text-muted-foreground">
                  {j.firstSeen || "—"}
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {referredUrls.has(j.url) ? (
                      <Badge variant="success">
                        <Check className="h-3 w-3" />
                        Referral
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => askReferral(j)}
                        disabled={asking === j.url}
                        title="Track a referral ask for this job"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Referral
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={j.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open posting"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteJob(j)}
                      disabled={deleting.has(j.url)}
                      title="Remove this job"
                      className="text-muted-foreground hover:text-[hsl(var(--danger))]"
                    >
                      {deleting.has(j.url)
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No jobs match your filters.
        </p>
      )}
      {limit < filtered.length && (
        <div className="border-t border-border p-3 text-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            Show more ({filtered.length - limit} remaining)
          </Button>
        </div>
      )}

      <JobDetailDialog
        job={selected}
        apps={apps}
        reports={reports}
        referrals={referrals}
        onReferralChange={onReferralChange}
        onSaved={onSaved}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </Card>
  );
}
