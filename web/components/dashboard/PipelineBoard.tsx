"use client";

/* ————————————————————————————————————————————————————————————————
   PipelineBoard — the application pipeline as a 6-column Kanban.

   Evaluate → Applied → Responded → Interview → Offer → Rejected, built
   entirely from the existing `apps` feed (data/applications.md). Cards can
   be nudged between adjacent stages via the existing PATCH endpoint; a move
   into Interview fires confetti. Visual layer only.
———————————————————————————————————————————————————————————————— */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { focusRing } from "./meridian";
import { ReportDialog } from "./ReportDialog";
import { Confetti } from "./Confetti";
import type { Application } from "@/lib/types";

/** The ordered board columns and the canonical status each maps to. */
const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "Evaluated", label: "Evaluate", color: "var(--amber)" },
  { key: "Applied", label: "Applied", color: "var(--t2)" },
  { key: "Responded", label: "Responded", color: "var(--amber)" },
  { key: "Interview", label: "Interview", color: "var(--green)" },
  { key: "Offer", label: "Offer", color: "var(--green)" },
  { key: "Rejected", label: "Rejected", color: "var(--red)" },
];
const ORDER = COLUMNS.map((c) => c.key);

export function PipelineBoard({
  apps,
  loading,
  onChange,
  onNavigate,
}: {
  apps: Application[];
  loading: boolean;
  onChange?: () => Promise<void> | void;
  onNavigate?: (tab: string) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);

  const byColumn = useMemo(() => {
    const map = new Map<string, Application[]>();
    for (const c of COLUMNS) map.set(c.key, []);
    for (const a of apps) {
      if (map.has(a.status)) map.get(a.status)!.push(a);
    }
    return map;
  }, [apps]);

  const hidden = apps.length - Array.from(byColumn.values()).reduce((n, l) => n + l.length, 0);

  async function move(app: Application, dir: -1 | 1) {
    const idx = ORDER.indexOf(app.status);
    const next = ORDER[idx + dir];
    if (!next) return;
    setSaving(app.num);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: app.num, status: next }),
      });
      if (res.ok) {
        if (next === "Interview") setConfetti((n) => n + 1);
        await onChange?.();
      }
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[color:var(--t3)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pipeline…
      </div>
    );
  }

  return (
    <div>
      <Confetti trigger={confetti} />

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-[22px] font-medium tracking-tight text-[color:var(--t1)]">Pipeline</h2>
          <p className="mt-0.5 text-[13px] text-[color:var(--t2)]">
            {apps.length} tracked · nudge a card with the arrows to move it a stage
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate("applications")}
            className={`rounded-md text-[13px] font-medium text-[color:var(--amber)] transition-opacity hover:opacity-80 ${focusRing}`}
          >
            Table view →
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((col) => {
          const items = byColumn.get(col.key) ?? [];
          return (
            <div
              key={col.key}
              className="flex min-h-[120px] flex-col rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)]"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--rule)] px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--t2)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                  {col.label}
                </span>
                <span className="font-num text-[11px] tabular-nums text-[color:var(--t3)]">
                  {items.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-6 text-[11px] text-[color:var(--t3)]">
                    —
                  </div>
                ) : (
                  items.map((a) => {
                    const idx = ORDER.indexOf(a.status);
                    const busy = saving === a.num;
                    return (
                      <div
                        key={a.num}
                        className="group rounded-lg border border-[color:var(--rule)] bg-[color:var(--s2)] p-2.5 transition-colors hover:border-[color:var(--rule-strong)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium text-[color:var(--t1)]">
                              {a.company}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[color:var(--t3)]">
                              {a.role}
                            </div>
                          </div>
                          {a.scoreNum != null && (
                            <span className="font-num shrink-0 text-[13px] font-medium tabular-nums text-[color:var(--amber)]">
                              {a.scoreNum.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button
                              disabled={idx <= 0 || busy}
                              onClick={() => move(a, -1)}
                              className={`flex h-6 w-6 items-center justify-center rounded text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] disabled:pointer-events-none disabled:opacity-30 ${focusRing}`}
                              title="Move back a stage"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              disabled={idx >= ORDER.length - 1 || busy}
                              onClick={() => move(a, 1)}
                              className={`flex h-6 w-6 items-center justify-center rounded text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] disabled:pointer-events-none disabled:opacity-30 ${focusRing}`}
                              title="Move forward a stage"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          {a.reportNum && (
                            <div className="opacity-0 transition-opacity group-hover:opacity-100">
                              <ReportDialog reportId={a.reportNum} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hidden > 0 && (
        <p className="mt-4 text-[12px] text-[color:var(--t3)]">
          {hidden} discarded or skipped {hidden === 1 ? "role is" : "roles are"} hidden from the board.
        </p>
      )}
    </div>
  );
}
