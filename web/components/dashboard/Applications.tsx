"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportDialog } from "./ReportDialog";
import { statusVariant, scoreVariant } from "./status";
import type { Application } from "@/lib/types";

const VARIANT_CLS: Record<string, string> = {
  success: "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
  warning: "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
  danger:  "border-[hsl(var(--danger))]/30  bg-[hsl(var(--danger))]/15  text-[hsl(var(--danger))]",
  primary: "border-primary/30 bg-primary/15 text-primary",
  accent:  "border-accent/30  bg-accent/15  text-accent",
  outline: "border-border bg-transparent text-muted-foreground",
  default: "border-transparent bg-secondary text-secondary-foreground",
};

const STATES = [
  "Evaluated",
  "Applied",
  "Responded",
  "Interview",
  "Offer",
  "Rejected",
  "Discarded",
  "SKIP",
];

function StatusEditor({
  app,
  onChange,
}: {
  app: Application;
  onChange?: () => Promise<void> | void;
}) {
  const [value, setValue] = useState(app.status);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(next: string) {
    setOpen(false);
    if (next === value) return;
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: app.num, status: next }),
      });
      if (!res.ok) setValue(prev);
      else await onChange?.();
    } catch {
      setValue(prev);
    } finally {
      setSaving(false);
    }
  }

  const colorCls = VARIANT_CLS[statusVariant(value)] ?? VARIANT_CLS.default;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !saving && setOpen((o) => !o)}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${colorCls}${saving ? " opacity-60 cursor-wait" : ""}`}
      >
        {value}
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border border-border bg-card shadow-lg">
          {STATES.map((s) => {
            const sCls = VARIANT_CLS[statusVariant(s)] ?? VARIANT_CLS.default;
            return (
              <button
                key={s}
                onClick={() => pick(s)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60 ${s === value ? "bg-secondary/40 font-semibold" : ""}`}
              >
                <span className={`inline-flex rounded border px-1.5 py-0 text-[10px] font-medium ${sCls}`}>
                  {s}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Applications({
  apps,
  loading,
  onChange,
}: {
  apps: Application[];
  loading: boolean;
  onChange?: () => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");

  if (loading) return <Skeleton className="h-96" />;

  if (apps.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No applications yet. Evaluate a job and it will appear here.
      </Card>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? apps.filter(
        (a) =>
          a.company.toLowerCase().includes(q) ||
          (a.role || "").toLowerCase().includes(q) ||
          (a.status || "").toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q)
      )
    : apps;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company, role, status, notes…"
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {q && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {apps.length} applications
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 text-right font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No matches for &ldquo;{query}&rdquo;
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.num}
                    className="border-b border-border/60 align-top transition-colors hover:bg-secondary/40"
                  >
                    <td className="font-num px-3 py-2 text-muted-foreground">{a.num}</td>
                    <td className="font-num px-3 py-2 text-xs text-muted-foreground">
                      {a.date}
                    </td>
                    <td className="px-3 py-2 font-medium">{a.company}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.role}</td>
                    <td className="px-3 py-2">
                      <Badge variant={scoreVariant(a.scoreNum)}>{a.score}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <StatusEditor app={a} onChange={onChange} />
                    </td>
                    <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">
                      {a.notes}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        {a.reportNum ? (
                          <ReportDialog reportId={a.reportNum} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
