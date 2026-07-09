"use client";

import { useMemo, useState } from "react";
import { ExternalLink, BookOpen, Search, FileCheck2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportDialog } from "./ReportDialog";
import { ScoreBadge, focusRing } from "./meridian";
import type { Application, ReportMeta } from "@/lib/types";

/* Warm status chip colours by canonical state. */
function statusStyle(status: string): { color: string; bg: string; label: string } {
  const s = status.toLowerCase();
  if (s === "offer") return { color: "var(--green)", bg: "var(--green-dim)", label: status };
  if (s === "interview") return { color: "var(--green)", bg: "var(--green-dim)", label: status };
  if (s === "responded") return { color: "var(--amber)", bg: "var(--amber-dim)", label: status };
  if (s === "applied") return { color: "var(--amber)", bg: "var(--amber-dim)", label: status };
  if (s === "rejected") return { color: "var(--red)", bg: "var(--red-dim)", label: status };
  if (s === "discarded" || s === "skip") return { color: "var(--t3)", bg: "var(--s3)", label: status };
  return { color: "var(--t2)", bg: "var(--s3)", label: status || "Evaluated" };
}

function StatusChip({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

export function ReportsView({
  reports,
  apps = [],
  loading,
}: {
  reports: ReportMeta[];
  apps?: Application[];
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "score">("recent");

  // Match each report to its application (by company::role) for status + PDF.
  const appByKey = useMemo(() => {
    const map = new Map<string, Application>();
    for (const a of apps) map.set(`${a.company.toLowerCase()}::${(a.role || "").toLowerCase()}`, a);
    return map;
  }, [apps]);

  const stats = useMemo(() => {
    const scored = reports.filter((r) => typeof r.scoreNum === "number");
    const avg = scored.length
      ? scored.reduce((s, r) => s + (r.scoreNum ?? 0), 0) / scored.length
      : null;
    const applied = apps.filter((a) =>
      ["Applied", "Responded", "Interview", "Offer"].includes(a.status)
    ).length;
    return { total: reports.length, avg, applied };
  }, [reports, apps]);

  const rows = useMemo(() => {
    const term = q.toLowerCase().trim();
    let list = reports;
    if (term) {
      list = list.filter(
        (r) =>
          r.company.toLowerCase().includes(term) ||
          (r.role || "").toLowerCase().includes(term) ||
          (r.legitimacy || "").toLowerCase().includes(term)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "score") return (b.scoreNum ?? 0) - (a.scoreNum ?? 0);
      return (b.date || "").localeCompare(a.date || "");
    });
  }, [reports, q, sort]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[color:var(--rule)] bg-[color:var(--s1)] py-16 text-center text-[14px] text-[color:var(--t3)]">
        No evaluation reports yet.
      </div>
    );
  }

  return (
    <div>
      {/* ————— Stats row ————— */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: "Total reports", value: String(stats.total), tone: "var(--t1)" },
          { label: "Average score", value: stats.avg != null ? stats.avg.toFixed(1) : "—", tone: "var(--amber)" },
          { label: "Applied", value: String(stats.applied), tone: "var(--green)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)] px-4 py-3"
          >
            <div className="font-num text-[26px] font-medium leading-none tabular-nums" style={{ color: s.tone }}>
              {s.value}
            </div>
            <div className="mt-1.5 text-[12px] text-[color:var(--t2)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ————— Filter bar ————— */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--t3)]" />
          <input
            placeholder="Search company, role, legitimacy…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] py-2 pl-9 pr-3 text-[13px] text-[color:var(--t1)] placeholder:text-[color:var(--t3)] focus:border-[color:var(--amber-border)] focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "score")}
          className="cursor-pointer rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] px-2.5 py-2 text-[13px] text-[color:var(--t2)] focus:border-[color:var(--amber-border)] focus:outline-none"
        >
          <option value="recent">Most recent</option>
          <option value="score">Highest score</option>
        </select>
      </div>

      {/* ————— Table ————— */}
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--rule)] text-left text-[11px] text-[color:var(--t3)]">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-center font-medium">PDF</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const app = appByKey.get(`${r.company.toLowerCase()}::${(r.role || "").toLowerCase()}`);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--rule)] transition-colors last:border-0 hover:bg-[color:var(--s2)]"
                  >
                    <td className="font-num whitespace-nowrap px-4 py-2.5 text-[12px] text-[color:var(--t3)]">
                      {r.date || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[color:var(--t1)]">{r.company}</td>
                    <td className="max-w-[240px] px-4 py-2.5 text-[color:var(--t2)]">
                      <span className="line-clamp-1">{r.role || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.scoreNum != null ? <ScoreBadge score={r.scoreNum} size="sm" /> : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={app?.status ?? "Evaluated"} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {app?.pdf ? (
                        <FileCheck2 className="mx-auto h-4 w-4 text-[color:var(--green)]" />
                      ) : (
                        <span className="text-[color:var(--t3)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <ReportDialog
                          reportId={r.id}
                          trigger={
                            <button
                              className={`inline-flex items-center gap-1.5 rounded-md border border-[color:var(--rule)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] ${focusRing}`}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Read
                            </button>
                          }
                        />
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open posting"
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] ${focusRing}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[color:var(--t3)]">
                    No reports match &ldquo;{q}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
