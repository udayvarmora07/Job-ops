"use client";

import { useRef, useState } from "react";
import { Sparkles, Loader2, StopCircle, Save, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownOutput } from "@/components/ui/markdown-output";

type TaskDef = { value: string; label: string; placeholder: string };

// Mirrors the builder tasks in config/ai.yml — each routes to its own model.
const TASKS: TaskDef[] = [
  { value: "evaluate_job", label: "Evaluate job (A–G)", placeholder: "Paste the full job description…" },
  { value: "tailor_cv", label: "Tailor CV to JD", placeholder: "Paste the job description to tailor your CV for…" },
  { value: "cover_letter", label: "Cover letter", placeholder: "Paste the JD / brief for the cover letter…" },
  { value: "draft_referral", label: "Referral outreach", placeholder: "Role, company, contact type (e.g. peer/recruiter)…" },
  { value: "interview_prep", label: "Interview prep", placeholder: "Company, role, stage, JD…" },
];

const MODEL_HINT: Record<string, string> = {
  evaluate_job: "DeepSeek V4 Pro",
  tailor_cv: "Kimi K2.6 (NIM)",
  cover_letter: "GLM 5.1",
  draft_referral: "MiniMax M3",
  interview_prep: "DeepSeek V4 Pro",
};

export function AiStudio({ onSaved }: { onSaved?: () => Promise<void> | void } = {}) {
  const [task, setTask] = useState(TASKS[0].value);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showPdfButton =
    !running && !!output && !error &&
    (task === "tailor_cv" || task === "cover_letter");

  async function downloadPdf() {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const isCv = task === "tailor_cv";
      const endpoint = isCv ? "/api/generate-cv-pdf" : "/api/generate-cover-pdf";
      const body = isCv ? { jd: input } : { text: output };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg = await res.text();
        setPdfError(`PDF failed: ${msg}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isCv
        ? "Uday_Varmora_Tailored_Resume.pdf"
        : "Cover_Letter_Uday_Varmora.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  }

  const current = TASKS.find((t) => t.value === task)!;

  async function evaluateAndSave() {
    if (!input.trim() || running) return;
    setRunning(true);
    setOutput("");
    setError(null);
    setModel(null);
    setSaved(null);
    setPdfError(null);
    try {
      const res = await fetch(`/api/evaluate-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Evaluation failed.");
        return;
      }
      setOutput(data.report || "");
      setSaved(`Saved as report #${data.num} · ${data.company} — ${data.role} (${data.score})`);
      await onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function run() {
    if (!input.trim() || running) return;
    setRunning(true);
    setOutput("");
    setError(null);
    setModel(null);
    setSaved(null);
    setPdfError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`/api/ai/${task}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
        signal: ctrl.signal,
      });
      setModel(res.headers.get("x-ai-model"));

      if (!res.ok || !res.body) {
        setError(await res.text());
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Input panel */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Studio</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            via NVIDIA NIM · {MODEL_HINT[task]}
          </span>
        </div>

        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Task
        </label>
        <select
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {TASKS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={current.placeholder}
          rows={12}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={running || !input.trim()}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Generating…" : task === "evaluate_job" ? "Preview" : "Run"}
          </Button>
          {task === "evaluate_job" && (
            <Button variant="default" onClick={evaluateAndSave} disabled={running || !input.trim()} title="Evaluate and save report + tracker entry">
              <Save className="h-4 w-4" />
              Evaluate &amp; Save
            </Button>
          )}
          {running && (
            <Button variant="outline" onClick={stop}>
              <StopCircle className="h-4 w-4" />
              Stop
            </Button>
          )}
        </div>
        {saved && (
          <p className="mt-2 rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-400">
            {saved}
          </p>
        )}
      </Card>

      {/* Output panel */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Output</h3>
          {model && (
            <span className="ml-auto rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {model}
            </span>
          )}
        </div>
        {error ? (
          <p className="whitespace-pre-wrap text-sm text-[hsl(var(--danger))]">{error}</p>
        ) : output ? (
          <MarkdownOutput content={output} streaming={running} maxHeight="28rem" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a task, paste your input, and hit Run. Output streams live here.
          </p>
        )}

        {showPdfButton && (
          <div className="mt-3 border-t border-border pt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={downloadPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              {pdfLoading
                ? task === "tailor_cv" ? "Building CV PDF…" : "Building PDF…"
                : task === "tailor_cv" ? "Download CV PDF" : "Download Cover Letter PDF"}
            </Button>
            {pdfError && (
              <p className="mt-2 text-xs text-[hsl(var(--danger))]">{pdfError}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
