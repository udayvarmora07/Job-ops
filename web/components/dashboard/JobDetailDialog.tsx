"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Sparkles,
  Loader2,
  Users,
  Linkedin,
  Search,
  Copy,
  Check,
  UserPlus,
  UserSearch,
  FileDown,
  RefreshCw,
  Mail,
  BookOpen,
  ClipboardCheck,
  Eye,
  SendHorizonal,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownOutput } from "@/components/ui/markdown-output";
import { ReportDialog } from "./ReportDialog";
import { ConnectionNotes } from "./ConnectionNotes";
import { ResumeQaPanel } from "./ResumeQaPanel";
import type {
  ResumeQa,
  Application,
  Job,
  ReportMeta,
  Referral,
  AiReferralTarget,
} from "@/lib/types";

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </Button>
  );
}

const WARMTH: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-slate-500/15 text-slate-400",
};

export function JobDetailDialog({
  job,
  apps,
  reports,
  referrals,
  onReferralChange,
  open,
  onOpenChange,
  onSaved,
}: {
  job: Job | null;
  apps: Application[];
  reports: ReportMeta[];
  referrals: Referral[];
  onReferralChange: () => Promise<void>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => Promise<void> | void;
}) {
  // ── matched data ──────────────────────────────────────────────────────────
  const app = useMemo(() => {
    if (!job) return null;
    const jc = norm(job.company);
    const jr = norm(job.role);
    return (
      apps.find(
        (a) =>
          norm(a.company) === jc &&
          (norm(a.role) === jr ||
            norm(a.role).includes(jr) ||
            jr.includes(norm(a.role)))
      ) ||
      apps.find((a) => norm(a.company) === jc) ||
      null
    );
  }, [job, apps]);

  const report = useMemo(() => {
    if (!job) return null;
    if (app?.reportNum) {
      const r = reports.find((x) => x.id === app.reportNum);
      if (r) return r;
    }
    const jc = norm(job.company);
    return reports.find((x) => norm(x.company) === jc) || null;
  }, [job, app, reports]);

  const tracked = useMemo(
    () => (job ? referrals.find((r) => r.jobUrl === job.url) : null),
    [job, referrals]
  );

  // ── résumé tailoring (streamed) ──────────────────────────────────────────
  const [resume, setResume] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [lastInput, setLastInput] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [qa, setQa] = useState<ResumeQa | null>(null);
  const [qaBusy, setQaBusy] = useState(false);

  type SavedResume = { name: string; version: number; url: string; mtime: string };
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  async function loadSavedResumes(company: string, role: string) {
    try {
      const res = await fetch(
        `/api/resumes?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}`
      );
      const data = await res.json();
      setSavedResumes(data.files || []);
    } catch {
      setSavedResumes([]);
    }
  }

  function openSavedVersion(sv: SavedResume) {
    setPdfUrl((prev) => {
      // Revoke any existing blob URL but keep server URLs
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return sv.url;
    });
    setActiveVersion(sv.version);
    // Load this version's cached QA if it was reviewed before.
    setQa(null);
    setQaBusy(false);
    fetch(`/api/resume-qa?file=${encodeURIComponent(sv.name)}`)
      .then((r) => r.json())
      .then((j) => { if (j?.qa) setQa(j.qa as ResumeQa); })
      .catch(() => {});
  }

  const resumeHeader = () =>
    !job
      ? ""
      : `Role: ${job.role || "(unspecified)"}\nCompany: ${job.company}${
          job.location ? `\nLocation: ${job.location}` : ""
        }`;

  // The full JD captured when the job was added to the pipeline (if any). This is
  // what makes tailoring JD-aware — without it, Tier-2 skills (Datadog, ELK, …)
  // can't be pulled in because the model never sees the requirement.
  async function resumeBrief(): Promise<string> {
    const header = resumeHeader();
    if (!job?.url) return header;
    try {
      const r = await fetch(`/api/pipeline?jd=${encodeURIComponent(job.url)}`);
      if (r.ok) {
        const jd = (await r.json()).jd as string;
        if (jd && jd.trim()) return `${header}\n\n${jd.trim()}`;
      }
    } catch {
      /* fall back to header-only */
    }
    return header;
  }

  function resumeFilename() {
    const sanitize = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const cap = (s: string, n: number) => s.split("_").slice(0, n).join("_");
    const co = sanitize(job?.company || "");
    const ro = sanitize(job?.role || "");
    // Always Company_Role (3 words each). Never drop company even when
    // scraped data has company == role (Naukri stores the full title in both).
    const cPart = co ? cap(co, 3) : "";
    const rPart = ro ? cap(ro, 3) : "";
    const suffix = (cPart && rPart) ? `${cPart}_${rPart}` : (cPart || rPart || "Tailored");
    return `Uday_Varmora_${suffix}_Resume.pdf`;
  }

  async function tailorResume(refinement?: string) {
    if (!job || resumeBusy) return;
    setResumeBusy(true);
    const prevResume = resume;
    setResume("");
    setPdfError(null);
    try {
      const brief = await resumeBrief();
      const input = refinement
        ? `${brief}\n\nPREVIOUS TAILORED CV OUTPUT:\n${prevResume}\n\nUSER REQUESTED CHANGES:\n${refinement}\n\nApply the requested changes and output an updated tailored CV.`
        : brief;
      setLastInput(input);
      const res = await fetch(`/api/ai/tailor_cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!res.ok || !res.body) {
        setResume(`Error: ${await res.text()}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setResume((p) => p + dec.decode(value, { stream: true }));
      }
    } finally {
      setResumeBusy(false);
    }
  }

  // Build the tailored résumé PDF and show it inline (WYSIWYG preview).
  // Saves a versioned copy server-side and refreshes the saved list.
  async function buildResumePdf(instructions?: string) {
    if (!job || pdfLoading) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const jd = await resumeBrief();
      const res = await fetch("/api/generate-cv-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd, url: job.url, company: job.company, role: job.role, instructions }),
      });
      if (!res.ok) {
        setPdfError(`PDF failed: ${await res.text()}`);
        return;
      }
      const savedVersion = parseInt(res.headers.get("X-Saved-Version") || "1", 10);
      const savedName = res.headers.get("X-Saved-Filename") || "";
      const blob = await res.blob();
      setPdfUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setActiveVersion(savedVersion);
      // Refresh the saved resumes list so the new version appears
      await loadSavedResumes(job.company, job.role);
      // Auto-QA the freshly generated résumé (non-blocking for the PDF preview).
      if (savedName) runQa(savedName, jd);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  }

  // Multi-perspective review of a generated résumé (spelling/grammar/consistency/
  // completeness/truthfulness/JD-ATS/impact/formatting/red-flags). Runs after every
  // generation; result is cached in a .qa.json sidecar.
  async function runQa(savedName: string, jd: string) {
    setQa(null);
    setQaBusy(true);
    try {
      const res = await fetch("/api/resume-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: savedName, jd }),
      });
      const json = await res.json();
      if (res.ok && json.qa) setQa(json.qa as ResumeQa);
    } catch {
      /* QA is best-effort; never blocks the résumé itself */
    } finally {
      setQaBusy(false);
    }
  }

  function downloadResumePdf() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = resumeFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── cover letter (streamed) ───────────────────────────────────────────────
  const [cover, setCover] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverPdfLoading, setCoverPdfLoading] = useState(false);
  const [coverPdfError, setCoverPdfError] = useState<string | null>(null);

  async function generateCover() {
    if (!job || coverBusy) return;
    setCoverBusy(true);
    setCover("");
    setCoverPdfError(null);
    try {
      const brief = `Role: ${job.role || "(unspecified)"}\nCompany: ${job.company}${
        job.location ? `\nLocation: ${job.location}` : ""
      }`;
      const res = await fetch("/api/ai/cover_letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: brief }),
      });
      if (!res.ok || !res.body) {
        setCover(`Error: ${await res.text()}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setCover((p) => p + dec.decode(value, { stream: true }));
      }
    } finally {
      setCoverBusy(false);
    }
  }

  async function downloadCoverPdf() {
    if (!job || !cover) return;
    setCoverPdfLoading(true);
    setCoverPdfError(null);
    try {
      const res = await fetch("/api/generate-cover-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cover }),
      });
      if (!res.ok) {
        setCoverPdfError(`PDF failed: ${await res.text()}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cover_Letter_${(job.company || "").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setCoverPdfError((e as Error).message);
    } finally {
      setCoverPdfLoading(false);
    }
  }

  // ── interview prep (streamed) ─────────────────────────────────────────────
  const [prep, setPrep] = useState("");
  const [prepBusy, setPrepBusy] = useState(false);

  async function generatePrep() {
    if (!job || prepBusy) return;
    setPrepBusy(true);
    setPrep("");
    try {
      const brief = `Company: ${job.company}\nRole: ${job.role || "(unspecified)"}${
        job.location ? `\nLocation: ${job.location}` : ""
      }\nStage: First Round`;
      const res = await fetch("/api/ai/interview_prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: brief }),
      });
      if (!res.ok || !res.body) {
        setPrep(`Error: ${await res.text()}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setPrep((p) => p + dec.decode(value, { stream: true }));
      }
    } finally {
      setPrepBusy(false);
    }
  }

  // ── evaluate & save ───────────────────────────────────────────────────────
  const [evalSaved, setEvalSaved] = useState<{
    num: string; score: string; company: string; role: string;
  } | null>(null);
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // ── mark as applied ───────────────────────────────────────────────────────
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function evaluateJob() {
    if (!job || evalBusy) return;
    setEvalBusy(true);
    setEvalError(null);
    setEvalSaved(null);
    try {
      const brief = [
        `Role: ${job.role || "Unknown"}`,
        `Company: ${job.company}`,
        job.location ? `Location: ${job.location}` : "",
        job.url ? `URL: ${job.url}` : "",
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/evaluate-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: brief }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEvalError(data.error || "Evaluation failed.");
        return;
      }
      setEvalSaved({ num: data.num, score: data.score, company: data.company, role: data.role });
      await onSaved?.();
    } catch (e) {
      setEvalError((e as Error).message);
    } finally {
      setEvalBusy(false);
    }
  }

  async function markApplied() {
    if (!job || applyBusy) return;
    setApplyBusy(true);
    setApplyError(null);
    try {
      let res: Response;
      if (app) {
        // Update existing tracker entry.
        res = await fetch("/api/applications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ num: app.num, status: "Applied" }),
        });
      } else {
        // Create a new entry via TSV → merge-tracker flow.
        res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: job.company, role: job.role, url: job.url }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Failed to mark as applied");
      }
      setApplyDone(true);
      await onSaved?.();
    } catch (e) {
      setApplyError((e as Error).message);
    } finally {
      setApplyBusy(false);
    }
  }

  // ── AI referral targets ───────────────────────────────────────────────────
  const [targets, setTargets] = useState<AiReferralTarget[]>([]);
  const [strategy, setStrategy] = useState("");
  const [refBusy, setRefBusy] = useState(false);
  const [refErr, setRefErr] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  type Person = { name: string; firstName: string; headline: string; url: string };
  const [people, setPeople] = useState<
    Record<number, { loading: boolean; list: Person[]; err?: string }>
  >({});

  async function findPeople(t: AiReferralTarget) {
    if (!job) return;
    setPeople((p) => ({ ...p, [t.rank]: { loading: true, list: [] } }));
    try {
      const res = await fetch(`/api/referrals/find-people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: job.company, role: job.role, keywords: t.linkedinKeywords, persona: t.persona }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPeople((p) => ({ ...p, [t.rank]: { loading: false, list: [], err: data.error } }));
        return;
      }
      setPeople((p) => ({ ...p, [t.rank]: { loading: false, list: data.people || [] } }));
    } catch (e) {
      setPeople((p) => ({ ...p, [t.rank]: { loading: false, list: [], err: (e as Error).message } }));
    }
  }

  async function findReferrals(refresh = false) {
    if (!job || refBusy) return;
    setRefBusy(true);
    setRefErr(null);
    try {
      const res = await fetch(`/api/referrals/ai-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: job.company, role: job.role, refresh }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefErr(data.error || "Failed to generate referral targets.");
        return;
      }
      setStrategy(data.strategy || "");
      setTargets(data.targets || []);
      loadedFor.current = job.url;
    } catch (e) {
      setRefErr((e as Error).message);
    } finally {
      setRefBusy(false);
    }
  }

  async function trackReferral() {
    if (!job) return;
    await fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: job.company,
        role: job.role,
        jobUrl: job.url,
        channel: "LinkedIn",
        status: "to_ask",
      }),
    });
    await onReferralChange();
  }

  // Reset all transient state when dialog opens for a new job
  useEffect(() => {
    if (!open || !job) return;
    setPeople({});
    setResume("");
    setFollowUp("");
    setLastInput("");
    setPdfError(null);
    setPdfUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setActiveVersion(null);
    setQa(null);
    setQaBusy(false);
    setSavedResumes([]);
    loadSavedResumes(job.company, job.role);
    setCover("");
    setCoverPdfError(null);
    setPrep("");
    setEvalSaved(null);
    setEvalError(null);
    setApplyBusy(false);
    setApplyDone(false);
    setApplyError(null);
    setRefErr(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/referrals/ai-targets?company=${encodeURIComponent(job.company)}&role=${encodeURIComponent(
            job.role || ""
          )}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.cached && data.targets?.length) {
          setStrategy(data.strategy || "");
          setTargets(data.targets);
        } else {
          setStrategy("");
          setTargets([]);
        }
      } catch {
        if (!cancelled) {
          setStrategy("");
          setTargets([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.url]);

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <div className="border-b border-border px-5 py-3 pr-12">
          <DialogTitle className="text-sm font-semibold">
            {job.company}
            {job.role ? <span className="text-muted-foreground"> · {job.role}</span> : null}
          </DialogTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {job.location && <span>{job.location}</span>}
            {job.portal && <Badge variant="outline">{job.portal.replace("-api", "")}</Badge>}
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Open posting
            </a>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-4" style={{ maxHeight: "75vh" }}>

          {/* STATUS ------------------------------------------------------- */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Status
            </h4>
            {app ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{app.status}</Badge>
                {app.score && <span className="font-num">Score {app.score}</span>}
                {app.date && <span className="text-muted-foreground">· {app.date}</span>}
                {report && (
                  <ReportDialog
                    reportId={report.id}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <FileText className="h-3.5 w-3.5" /> View report
                      </Button>
                    }
                  />
                )}
                {tracked && (
                  <Badge variant="success">
                    <Check className="h-3 w-3" /> Referral: {tracked.status}
                  </Badge>
                )}
                {app.notes && (
                  <p className="w-full text-xs text-muted-foreground">{app.notes}</p>
                )}
                {/* Applied button — only when not already applied */}
                {app.status !== "Applied" && (
                  <div className="w-full pt-1">
                    {applyDone ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--success))]">
                        <Check className="h-3.5 w-3.5" /> Marked as Applied
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={markApplied} disabled={applyBusy}>
                        {applyBusy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <SendHorizonal className="h-3.5 w-3.5" />}
                        {applyBusy ? "Saving…" : "Mark as Applied"}
                      </Button>
                    )}
                    {applyError && (
                      <p className="mt-1 text-xs text-[hsl(var(--danger))]">{applyError}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Not evaluated yet — no tracker entry.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={evaluateJob}
                    disabled={evalBusy}
                  >
                    {evalBusy
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ClipboardCheck className="h-3.5 w-3.5" />}
                    {evalBusy ? "Evaluating… (30–60 s)" : "Evaluate & Save"}
                  </Button>
                  {applyDone ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--success))]">
                      <Check className="h-3.5 w-3.5" /> Marked as Applied
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={markApplied} disabled={applyBusy}>
                      {applyBusy
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <SendHorizonal className="h-3.5 w-3.5" />}
                      {applyBusy ? "Saving…" : "Applied"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Quick evaluation using role + company info. For a full JD evaluation, paste the description in AI Studio.
                </p>
                {evalSaved && (
                  <p className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-400">
                    Saved report #{evalSaved.num} · {evalSaved.company} — {evalSaved.role} ({evalSaved.score})
                  </p>
                )}
                {evalError && (
                  <p className="text-xs text-[hsl(var(--danger))]">{evalError}</p>
                )}
              </div>
            )}
          </section>

          {/* RÉSUMÉ ------------------------------------------------------- */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Résumé
            </h4>

            {/* Previously saved versions */}
            {savedResumes.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Saved:</span>
                {savedResumes.map((sv) => (
                  <button
                    key={sv.name}
                    onClick={() => openSavedVersion(sv)}
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-num text-xs transition-colors
                      ${activeVersion === sv.version
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    title={`${sv.name} — ${new Date(sv.mtime).toLocaleString()}`}
                  >
                    <FileText className="h-3 w-3" />
                    {sv.version === 1 ? "v1" : `v${sv.version}`}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Primary action: Generate (first time) or Update/add new version */}
              <Button onClick={() => buildResumePdf()} disabled={pdfLoading} size="sm">
                {pdfLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Eye className="h-3.5 w-3.5" />}
                {pdfLoading
                  ? "Building résumé…"
                  : savedResumes.length > 0
                    ? `Update résumé (save as v${savedResumes[0].version + 1})`
                    : "Generate & preview résumé"}
              </Button>
              <Button onClick={() => tailorResume()} disabled={resumeBusy} size="sm" variant="ghost">
                {resumeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {resumeBusy ? "Analyzing…" : resume ? "Re-run analysis" : "Show tailoring analysis"}
              </Button>
            </div>
            {pdfError && <p className="mt-2 text-xs text-[hsl(var(--danger))]">{pdfError}</p>}

            {/* Auto QA — multi-perspective review after every generation */}
            {(qaBusy || qa) && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Résumé QA — auto-review
                </p>
                <ResumeQaPanel
                  qa={qa}
                  busy={qaBusy}
                  selectable
                  onApply={(instructions) => buildResumePdf(instructions)}
                  applyBusy={pdfLoading}
                />
              </div>
            )}

            {/* Inline WYSIWYG PDF preview */}
            {pdfUrl && (
              <div className="mt-3 space-y-2">
                {activeVersion && (
                  <p className="font-num text-[10px] text-muted-foreground">
                    Previewing v{activeVersion}
                    {activeVersion === 1 ? " (original)" : " (updated)"}
                  </p>
                )}
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                  title="Résumé preview"
                  className="w-full rounded-md border border-border bg-white"
                  style={{ height: "78vh" }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={downloadResumePdf}>
                    <FileDown className="h-3.5 w-3.5" /> Download PDF
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {resume && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tailoring analysis (text)
                </p>
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <MarkdownOutput content={resume} streaming={resumeBusy} maxHeight="18rem" className="text-xs" />
                </div>

                {!resumeBusy && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton text={resume} />
                    </div>

                    <div className="rounded-md border border-border bg-background/30 p-3">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Request changes to the resume:
                      </p>
                      <textarea
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        placeholder="e.g. 'Emphasize Kubernetes and GitOps more', 'Move the serverless project to the top'…"
                        rows={2}
                        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => { tailorResume(followUp); setFollowUp(""); }}
                        disabled={!followUp.trim() || resumeBusy}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Apply changes &amp; re-tailor
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* COVER LETTER ------------------------------------------------- */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> Cover Letter
            </h4>
            <Button onClick={generateCover} disabled={coverBusy} size="sm">
              {coverBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {coverBusy ? "Writing…" : cover ? "Re-generate cover letter" : "Generate cover letter"}
            </Button>

            {cover && (
              <div className="mt-2 space-y-2">
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <MarkdownOutput content={cover} streaming={coverBusy} maxHeight="18rem" className="text-xs" />
                </div>

                {!coverBusy && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton text={cover} />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={downloadCoverPdf}
                        disabled={coverPdfLoading}
                      >
                        {coverPdfLoading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <FileDown className="h-3.5 w-3.5" />}
                        {coverPdfLoading ? "Building PDF…" : "Download PDF"}
                      </Button>
                    </div>
                    {coverPdfError && (
                      <p className="text-xs text-[hsl(var(--danger))]">{coverPdfError}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          {/* INTERVIEW PREP ----------------------------------------------- */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Interview Prep
            </h4>
            <Button onClick={generatePrep} disabled={prepBusy} size="sm">
              {prepBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              {prepBusy ? "Preparing…" : prep ? "Re-generate prep guide" : "Generate interview prep"}
            </Button>

            {prep && (
              <div className="mt-2 space-y-2">
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <MarkdownOutput content={prep} streaming={prepBusy} maxHeight="18rem" className="text-xs" />
                </div>
                {!prepBusy && (
                  <div className="flex items-center gap-2">
                    <CopyButton text={prep} />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* BEST REFERRAL PATHS ----------------------------------------- */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Best referral paths
              </h4>
              {!tracked && (
                <Button variant="ghost" size="sm" onClick={trackReferral} title="Track a referral ask">
                  <UserPlus className="h-3.5 w-3.5" /> Track
                </Button>
              )}
            </div>

            {targets.length === 0 ? (
              <div>
                <Button onClick={() => findReferrals()} disabled={refBusy} size="sm" variant="default">
                  {refBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                  {refBusy ? "Finding the right people…" : "Find 3 best referral people (AI)"}
                </Button>
                {refErr && (
                  <p className="mt-2 text-xs text-[hsl(var(--danger))]">{refErr}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Reasons from your background — past employers, college alumni, location, and the team — to find the warmest paths in.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {strategy && (
                  <p className="rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground">
                    {strategy}
                  </p>
                )}
                {targets.map((t) => (
                  <div key={t.rank} className="rounded-md border border-border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-num text-xs text-muted-foreground">#{t.rank}</span>
                      <span className="text-sm font-medium">{t.persona}</span>
                      <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] uppercase ${WARMTH[t.warmth] || WARMTH.low}`}>
                        {t.warmth}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90">
                      <span className="text-muted-foreground">Who: </span>
                      {t.who}
                    </p>
                    <p className="mt-1 text-xs text-foreground/90">
                      <span className="text-muted-foreground">Why: </span>
                      {t.why}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Button variant="outline" size="sm" asChild>
                        <a href={t.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-3.5 w-3.5" /> Find on LinkedIn
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={t.googleUrl} target="_blank" rel="noopener noreferrer">
                          <Search className="h-3.5 w-3.5" /> Google
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => findPeople(t)}
                        disabled={people[t.rank]?.loading}
                        title="Find real public profiles (off-account, via Apify)"
                      >
                        {people[t.rank]?.loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserSearch className="h-3.5 w-3.5" />
                        )}
                        Find real people
                      </Button>
                    </div>

                    {people[t.rank]?.err && (
                      <p className="mt-2 text-xs text-[hsl(var(--danger))]">{people[t.rank]?.err}</p>
                    )}
                    {people[t.rank]?.list && people[t.rank]!.list.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {people[t.rank]!.list.map((person) => (
                          <li
                            key={person.url}
                            className="flex items-center gap-2 rounded bg-background/60 px-2 py-1.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <a
                                href={person.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline"
                              >
                                {person.name}
                              </a>
                              {person.headline && (
                                <span className="block truncate text-muted-foreground">{person.headline}</span>
                              )}
                            </div>
                            <CopyButton
                              text={t.outreachMessage.replace(/\[their name\]/gi, person.firstName)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 rounded bg-background/60 p-2">
                      <p className="mb-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">LinkedIn DM (after connecting)</p>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{t.outreachMessage}</p>
                      <div className="mt-1">
                        <CopyButton text={t.outreachMessage} />
                      </div>
                    </div>
                    <ConnectionNotes
                      company={job.company}
                      role={job.role}
                      persona={t.persona}
                      why={t.why}
                    />
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => findReferrals(true)} disabled={refBusy}>
                  {refBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Regenerate
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
