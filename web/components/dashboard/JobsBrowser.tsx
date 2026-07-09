"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  UserPlus,
  Check,
  Plus,
  Loader2,
  Trash2,
  Search,
} from "lucide-react";
import { expBucket, type ExpBucket } from "@/lib/experience";
import { Skeleton } from "@/components/ui/skeleton";
import { JobDetailDialog } from "./JobDetailDialog";
import {
  GhostShield,
  ScoreBadge,
  SalaryBadge,
  PrivacyBadge,
  ghostShieldFromLegitimacy,
  focusRing,
} from "./meridian";
import type { Job, Referral, Application, ReportMeta } from "@/lib/types";

const PAGE = 48;

const inputCls =
  "w-full rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] px-3 py-2 text-[13px] text-[color:var(--t1)] placeholder:text-[color:var(--t3)] focus:border-[color:var(--amber-border)] focus:outline-none";
const selectCls =
  "cursor-pointer rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] px-2.5 py-2 text-[13px] text-[color:var(--t2)] focus:border-[color:var(--amber-border)] focus:outline-none";

/** Experience chip — green fits (≤3 yr), amber stretch (3–6 yr), muted over. */
function ExpChip({ exp, minYears }: { exp: string | null; minYears: number | null }) {
  if (!exp || minYears === null) return null;
  const style =
    minYears < 3
      ? { color: "var(--green)", background: "var(--green-dim)" }
      : minYears < 6
        ? { color: "var(--amber)", background: "var(--amber-dim)" }
        : { color: "var(--t2)", background: "var(--s3)" };
  return (
    <span
      className="font-num rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={style}
    >
      {exp}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[color:var(--rule)] bg-[color:var(--s2)] px-2 py-0.5 text-[11px] text-[color:var(--t2)]">
      {children}
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
    () => Array.from(new Set(jobs.map((j) => j.portal).filter(Boolean))) as string[],
    [jobs]
  );
  const referredUrls = useMemo(
    () => new Set(referrals.map((r) => r.jobUrl).filter(Boolean)),
    [referrals]
  );

  // Evaluated reports keyed by company::role — the honest source for a job's
  // score and Ghost Shield status (only evaluated postings carry legitimacy).
  const reportByKey = useMemo(() => {
    const map = new Map<string, ReportMeta>();
    for (const r of reports) {
      map.set(`${r.company.toLowerCase()}::${(r.role || "").toLowerCase()}`, r);
    }
    return map;
  }, [reports]);

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
        const b = expBucket(
          j.expMinYears !== null
            ? { display: j.expRequired ?? "", minYears: j.expMinYears, maxYears: null, source: "explicit" }
            : null
        );
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
  }, [jobs, q, portal, state, expFilter, appliedKeys]);

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
      setDeleting((prev) => {
        const s = new Set(prev);
        s.delete(j.url);
        return s;
      });
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
    <div>
      {/* ————— Header ————— */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-medium tracking-tight text-[color:var(--t1)]">Discover</h2>
          <p className="mt-0.5 text-[13px] text-[color:var(--t2)]">
            {filtered.length} of {jobs.length} open roles across your portals
          </p>
        </div>
        <PrivacyBadge />
      </div>

      {/* ————— Filter strip ————— */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--t3)]" />
            <input
              placeholder="Search company, role, location…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              className={inputCls + " pl-9"}
            />
          </div>
          <select value={portal} onChange={(e) => setPortal(e.target.value)} className={selectCls} aria-label="Portal">
            <option value="all">All portals</option>
            {portals.map((p) => (
              <option key={p} value={p}>
                {p.replace("-api", "")}
              </option>
            ))}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value)} className={selectCls} aria-label="State">
            <option value="all">All states</option>
            <option value="inbox">In inbox</option>
            <option value="pending">Pending eval</option>
            <option value="processed">Processed</option>
          </select>
          <select
            value={expFilter}
            onChange={(e) => {
              setExpFilter(e.target.value as "all" | ExpBucket);
              setLimit(PAGE);
            }}
            className={selectCls}
            aria-label="Experience"
          >
            <option value="all">All exp</option>
            <option value="entry">Entry (0–3 yr)</option>
            <option value="mid">Mid (3–6 yr)</option>
            <option value="senior">Senior (6+ yr)</option>
            <option value="unknown">Exp unknown</option>
          </select>
        </div>

        {/* Quick add URL */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] px-2.5 py-1.5">
          <Plus className="h-3.5 w-3.5 shrink-0 text-[color:var(--t3)]" />
          <input
            placeholder="Paste a job URL to add to your pipeline…"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAddUrl()}
            className="min-w-[200px] flex-1 bg-transparent text-[13px] text-[color:var(--t1)] placeholder:text-[color:var(--t3)] focus:outline-none"
          />
          <button
            onClick={submitAddUrl}
            disabled={addingUrl || !addUrl.trim()}
            className={`inline-flex items-center gap-1.5 rounded-md border border-[color:var(--rule)] px-3 py-1 text-[12px] font-medium text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            {addingUrl && <Loader2 className="h-3 w-3 animate-spin" />}
            {addingUrl ? "Adding…" : "Add"}
          </button>
          {addUrlMsg && <span className="text-[12px] text-[color:var(--t3)]">{addUrlMsg}</span>}
        </div>
      </div>

      {/* ————— Card grid ————— */}
      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[color:var(--rule)] bg-[color:var(--s1)] py-16 text-center text-[14px] text-[color:var(--t3)]">
          No jobs match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, limit).map((j) => {
            const rep = reportByKey.get(`${j.company.toLowerCase()}::${(j.role || "").toLowerCase()}`);
            const shield = rep
              ? ghostShieldFromLegitimacy(rep.legitimacy)
              : ({ status: "suspicious", label: "Not yet evaluated" } as const);
            const isDeleting = deleting.has(j.url);
            return (
              <div
                key={j.url}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(j)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail(j);
                  }
                }}
                className={`group flex cursor-pointer flex-col rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)] p-4 transition-colors hover:border-[color:var(--rule-strong)] hover:bg-[color:var(--s2)] ${focusRing}`}
              >
                {/* Top: company + role + score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium text-[color:var(--t1)]">
                      {j.company}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[color:var(--t2)]">
                      {j.role || "—"}
                    </div>
                  </div>
                  {rep?.scoreNum != null && <ScoreBadge score={rep.scoreNum} size="sm" />}
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {j.location && <Tag>{j.location}</Tag>}
                  {j.portal && <Tag>{j.portal.replace("-api", "")}</Tag>}
                  <ExpChip exp={j.expRequired} minYears={j.expMinYears} />
                </div>

                {/* Salary intelligence */}
                <div className="mt-3">
                  <SalaryBadge salary={null} />
                </div>

                {/* Footer: shield + actions */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--rule)] pt-3">
                  <GhostShield status={shield.status} label={shield.label} />
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {referredUrls.has(j.url) ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-1.5 text-[11px] font-medium text-[color:var(--green)]">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : (
                      <button
                        onClick={() => askReferral(j)}
                        disabled={asking === j.url}
                        title="Track a referral ask"
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] ${focusRing}`}
                      >
                        {asking === j.url ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open posting"
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] ${focusRing}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => deleteJob(j)}
                      disabled={isDeleting}
                      title="Remove this job"
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--red-dim)] hover:text-[color:var(--red)] ${focusRing}`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {limit < filtered.length && (
        <div className="mt-5 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className={`rounded-md border border-[color:var(--rule)] px-4 py-2 text-[13px] font-medium text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] ${focusRing}`}
          >
            Show more ({filtered.length - limit} remaining)
          </button>
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
    </div>
  );
}
