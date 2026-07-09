"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, HelpCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResumeQa, ResumeQaIssue } from "@/lib/types";

const VERDICT = {
  pass: { label: "Looks clean", variant: "success" as const, Icon: ShieldCheck },
  minor_issues: { label: "Minor issues", variant: "warning" as const, Icon: ShieldAlert },
  needs_fixes: { label: "Needs fixes", variant: "danger" as const, Icon: ShieldX },
  unknown: { label: "QA inconclusive", variant: "outline" as const, Icon: HelpCircle },
};

const SEV_VARIANT: Record<ResumeQaIssue["severity"], "danger" | "warning" | "outline"> = {
  high: "danger",
  medium: "warning",
  low: "outline",
};

const PERSPECTIVE_LABEL: Record<string, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  consistency: "Consistency",
  completeness: "Completeness",
  truthfulness: "Truthfulness",
  jd_ats: "JD / ATS",
  impact: "Impact",
  formatting: "Formatting",
  red_flags: "Red flags",
};

/** Combine selected QA issues + any extra free-text instructions. */
function buildInstructions(issues: ResumeQaIssue[], selected: Set<number>, extra: string): string {
  const parts: string[] = [];
  if (selected.size > 0) {
    const items = Array.from(selected).sort((a, b) => a - b).map((i) => issues[i]);
    const lines = items.map((it, n) => {
      const fix = it.suggestion || it.issue;
      const loc = it.where ? ` [at: "${it.where.slice(0, 80)}"]` : "";
      return `${n + 1}. ${fix}${loc}`;
    });
    parts.push(`Apply these ATS/QA improvements to the resume:\n${lines.join("\n")}`);
  }
  if (extra.trim()) {
    parts.push(`Additional instructions:\n${extra.trim()}`);
  }
  return parts.join("\n\n");
}

export function ResumeQaPanel({
  qa,
  busy,
  selectable = false,
  onApply,
  applyBusy = false,
}: {
  qa: ResumeQa | null;
  busy: boolean;
  /** When true, issues get checkboxes and an "Apply selected" button appears. */
  selectable?: boolean;
  /** Called with formatted instructions when user clicks Apply. */
  onApply?: (instructions: string) => void;
  /** Shows spinner inside the Apply button while the regeneration is running. */
  applyBusy?: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [extra, setExtra] = useState("");

  // Clear selection and extra notes whenever QA results change (after a regeneration cycle).
  useEffect(() => { setSelected(new Set()); setExtra(""); }, [qa]);

  if (busy && !qa) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reviewing résumé — spelling, grammar, consistency, truthfulness, JD/ATS fit…
      </div>
    );
  }
  if (!qa) return null;

  const v = VERDICT[qa.verdict] ?? VERDICT.unknown;
  const issues = [...qa.issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  const highCount = issues.filter((i) => i.severity === "high").length;

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === issues.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(issues.map((_, i) => i)));
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      {/* Header row */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={v.variant} className="gap-1">
          <v.Icon className="h-3.5 w-3.5" />
          {v.label}
        </Badge>
        {typeof qa.score === "number" && (
          <span className="font-num text-sm font-medium text-muted-foreground">
            ATS {qa.score}/100
          </span>
        )}
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">
          {issues.length === 0
            ? "no issues found"
            : `${issues.length} issue${issues.length > 1 ? "s" : ""}${highCount ? ` · ${highCount} high` : ""}`}
        </span>
        {/* Select-all toggle shown only in selectable mode with issues */}
        {selectable && issues.length > 0 && (
          <button
            onClick={toggleAll}
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {selected.size === issues.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {qa.summary && <p className="mb-2 text-sm text-muted-foreground">{qa.summary}</p>}

      {/* Deterministic ATS keyword-match breakdown — explains the ATS score */}
      {qa.ats?.score != null && (
        <div className="mb-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="font-medium text-foreground">Keyword match</span>
            <span>
              required{" "}
              <span className="font-num text-foreground">
                {qa.ats.requiredHit}/{qa.ats.requiredTotal}
              </span>
            </span>
            <span>
              total{" "}
              <span className="font-num text-foreground">
                {qa.ats.matched?.length ?? 0}/{(qa.ats.matched?.length ?? 0) + (qa.ats.missing?.length ?? 0)}
              </span>
            </span>
            {typeof qa.ats.penalties === "number" && qa.ats.penalties > 0 && (
              <span className="text-[hsl(var(--warning))]">−{qa.ats.penalties} stuffing</span>
            )}
            {typeof qa.modelScore === "number" && (
              <span className="opacity-70">model QA read: {qa.modelScore}</span>
            )}
          </div>
          {qa.ats.missing && qa.ats.missing.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground">Missing JD keywords:</span>
              {qa.ats.missing.slice(0, 12).map((m) => (
                <span
                  key={m.term}
                  className={[
                    "rounded px-1.5 py-0.5 font-mono text-[10px]",
                    m.weight === 3
                      ? "bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]"
                      : "bg-secondary text-muted-foreground",
                  ].join(" ")}
                  title={m.weight === 3 ? "required keyword" : "preferred keyword"}
                >
                  {m.term}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint shown only in selectable mode */}
      {selectable && issues.length > 0 && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Check the issues you want to fix, then click Apply — a new résumé version will be generated.
        </p>
      )}

      {issues.length > 0 && (
        <ul className="space-y-2">
          {issues.map((it, i) => (
            <li
              key={i}
              onClick={selectable ? () => toggle(i) : undefined}
              className={[
                "rounded-md border p-2 text-sm transition-colors",
                selectable ? "cursor-pointer select-none" : "",
                selected.has(i)
                  ? "border-primary/50 bg-primary/8 ring-1 ring-primary/20"
                  : "border-border/60 bg-background/40 hover:border-border",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 shrink-0 accent-primary"
                  />
                )}
                <Badge variant={SEV_VARIANT[it.severity] ?? "outline"}>{it.severity}</Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {PERSPECTIVE_LABEL[it.perspective] ?? it.perspective}
                </span>
              </div>
              <p className="text-foreground">{it.issue}</p>
              {it.where && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="opacity-70">where: </span>
                  <span className="font-mono">{it.where}</span>
                </p>
              )}
              {it.suggestion && (
                <p className="mt-0.5 text-xs text-[hsl(var(--success))]">→ {it.suggestion}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Extra instructions textarea — always visible in selectable mode */}
      {selectable && (
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Additional instructions{" "}
            <span className="opacity-60">(optional — anything else you want changed)</span>
          </label>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={
              "e.g. Add AWS Kinesis to Cloud Platforms skills row\n" +
              "Make the summary one line shorter\n" +
              "Lead with observability in experience bullet 3"
            }
            rows={3}
            disabled={applyBusy}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
      )}

      {/* Apply button — shown when anything is selected OR extra text is written */}
      {selectable && (selected.size > 0 || extra.trim()) && (
        <Button
          className="mt-2 w-full gap-1.5"
          size="sm"
          disabled={applyBusy}
          onClick={() => onApply?.(buildInstructions(issues, selected, extra))}
        >
          {applyBusy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Regenerating résumé…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              {selected.size > 0
                ? `Apply ${selected.size} fix${selected.size > 1 ? "es" : ""}${extra.trim() ? " + notes" : ""} → regenerate résumé`
                : "Apply notes → regenerate résumé"}
            </>
          )}
        </Button>
      )}

      {qa.perspectivesChecked?.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Checked: {qa.perspectivesChecked.map((p) => PERSPECTIVE_LABEL[p] ?? p).join(" · ")}
        </p>
      )}
    </div>
  );
}
