"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  RefreshCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResumeQaPanel } from "./ResumeQaPanel";
import { focusRing } from "./meridian";
import type { ResumeQa } from "@/lib/types";

interface ResumeFile {
  name: string;
  version: number;
  url: string;
  mtime: string;
  company: string | null;
  role: string | null;
}

interface ResumeGroup {
  suffix: string;
  displayName: string;
  files: ResumeFile[];
  latestMtime: string;
  company: string | null;
  role: string | null;
}

interface QaState {
  qa: ResumeQa | null;
  busy: boolean;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Best-effort company/role from suffix when no sidecar available. */
function parseSuffix(suffix: string): { company: string; role: string } {
  const stripped = suffix.replace(/^\d+_/, "");
  const words = stripped.split("_");
  const company = words[0].replace(/([a-z])([A-Z])/g, "$1 $2");
  const role = words
    .slice(1)
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return { company, role: role || company };
}

function VersionBadge({ version, latest }: { version: number; latest: boolean }) {
  return (
    <span
      className={`font-num inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
        latest
          ? "bg-[color:var(--amber-dim)] text-[color:var(--amber)]"
          : "bg-[color:var(--s3)] text-[color:var(--t3)]"
      }`}
    >
      v{version}
      {latest && <span className="ml-1 text-[9px] opacity-70">latest</span>}
    </span>
  );
}

/** ATS match badge — green ≥80, amber ≥60, muted below. */
function AtsBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? { color: "var(--green)", bg: "var(--green-dim)" }
      : score >= 60
        ? { color: "var(--amber)", bg: "var(--amber-dim)" }
        : { color: "var(--t2)", bg: "var(--s3)" };
  return (
    <span
      className="font-num rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
      style={{ color: tone.color, background: tone.bg }}
      title="ATS keyword match on the latest version"
    >
      {Math.round(score)}% ATS
    </span>
  );
}

/* ─── Preview modal ─────────────────────────────────────────────────────── */
function PreviewModal({
  file,
  onClose,
}: {
  file: { name: string; url: string } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!file) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [file, onClose]);

  if (!file) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <span className="truncate text-xs text-muted-foreground">{file.name}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" asChild>
              <a href={file.url} download={file.name}>
                <FileDown className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <iframe
          src={`${file.url}#toolbar=0&navpanes=0&view=FitH`}
          title={file.name}
          className="h-full w-full rounded-b-xl bg-white"
        />
      </div>
    </div>
  );
}

/* ─── Update modal ──────────────────────────────────────────────────────── */
function UpdateModal({
  group,
  onClose,
  onDone,
  initialInstructions = "",
}: {
  group: ResumeGroup;
  onClose: () => void;
  onDone: () => void;
  initialInstructions?: string;
}) {
  const fallback = parseSuffix(group.suffix);
  const company = group.company || fallback.company;
  const role = group.role || fallback.role;

  const [jd, setJd] = useState("");
  const [instructions, setInstructions] = useState(initialInstructions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const jdText = jd.trim() || `Company: ${company}\nRole: ${role}`;
      const res = await fetch("/api/generate-cv-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: jdText, company, role, instructions: instructions.trim() || undefined }),
      });
      if (!res.ok) {
        const t = await res.text();
        setError(`Generation failed: ${t.slice(0, 200)}`);
        return;
      }
      setDone(true);
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">
              Update résumé
            </p>
            <p className="mt-0.5 text-sm font-medium">{group.displayName}</p>
            <p className="font-num mt-0.5 text-xs text-muted-foreground">
              Will save as v{(group.files[0]?.version ?? 0) + 1}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Job description <span className="opacity-60">(optional — paste for best results)</span>
        </label>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder={`Paste the full JD here, or leave empty to re-tailor with:\nCompany: ${company}\nRole: ${role}`}
          rows={5}
          disabled={busy}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />

        <label className="mb-1 mt-3 block text-xs font-medium text-muted-foreground">
          Update instructions <span className="opacity-60">(what to change)</span>
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={"e.g. Emphasize Kubernetes and GitOps more\nMake the summary shorter and punchier\nStrengthen the SRE angle, lead with observability\nRemove the Terraform project, push Docker one up"}
          rows={5}
          disabled={busy}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />

        {error && (
          <p className="mt-2 text-xs text-[hsl(var(--danger))]">{error}</p>
        )}
        {done && (
          <p className="mt-2 text-xs text-emerald-400">
            New version saved — reloading…
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={regenerate} disabled={busy || done}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {busy ? "Building résumé… (30–60 s)" : "Regenerate & save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export function ResumesLibrary() {
  const [groups, setGroups] = useState<ResumeGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [updateTarget, setUpdateTarget] = useState<{ group: ResumeGroup; initialInstructions?: string } | null>(null);
  const [qaByGroup, setQaByGroup] = useState<Record<string, QaState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      setGroups(data.groups || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteFile(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    setDeleting((prev) => new Set(prev).add(filename));
    try {
      await fetch(`/api/resumes/${encodeURIComponent(filename)}`, { method: "DELETE" });
      await load();
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(filename); return s; });
    }
  }

  /** Toggle QA panel for a group: load cached result or run fresh QA. */
  async function toggleQa(group: ResumeGroup) {
    const key = group.suffix;

    // If already loaded/loading, toggle off.
    if (qaByGroup[key]) {
      setQaByGroup((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }

    const latestFile = group.files[0]?.name;
    if (!latestFile) return;

    setQaByGroup((prev) => ({ ...prev, [key]: { qa: null, busy: true } }));
    try {
      // Try cached sidecar first.
      const cached = await fetch(`/api/resume-qa?file=${encodeURIComponent(latestFile)}`);
      const cachedData = await cached.json();
      if (cachedData?.qa) {
        setQaByGroup((prev) => ({ ...prev, [key]: { qa: cachedData.qa, busy: false } }));
        return;
      }
      // No cache — run a fresh QA pass.
      const fresh = await fetch("/api/resume-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: latestFile }),
      });
      const freshData = await fresh.json();
      setQaByGroup((prev) => ({ ...prev, [key]: { qa: freshData.qa ?? null, busy: false } }));
    } catch {
      setQaByGroup((prev) => ({ ...prev, [key]: { qa: null, busy: false } }));
    }
  }

  const filtered = q
    ? groups.filter((g) =>
        g.displayName.toLowerCase().includes(q.toLowerCase()) ||
        g.suffix.toLowerCase().includes(q.toLowerCase())
      )
    : groups;

  if (loading) return <Skeleton className="h-96" />;

  return (
    <>
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
      {updateTarget && (
        <UpdateModal
          group={updateTarget.group}
          onClose={() => setUpdateTarget(null)}
          onDone={load}
          initialInstructions={updateTarget.initialInstructions}
        />
      )}

      {/* Header + toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-medium tracking-tight text-[color:var(--t1)]">Resumes</h2>
          <p className="mt-0.5 text-[13px] text-[color:var(--t2)]">
            {filtered.length} tailored {filtered.length === 1 ? "resume" : "resumes"} · {total} PDF
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--t3)]" />
            <input
              placeholder="Search resumes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] py-2 pl-9 pr-3 text-[13px] text-[color:var(--t1)] placeholder:text-[color:var(--t3)] focus:border-[color:var(--amber-border)] focus:outline-none"
            />
          </div>
          <button
            onClick={load}
            className={`flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--rule)] text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] ${focusRing}`}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[color:var(--rule)] bg-[color:var(--s1)] py-16 text-center text-[14px] text-[color:var(--t3)]">
          {q ? "No resumes match your search." : "No resumes saved yet. Generate one from Discover."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((group) => {
            const qa = qaByGroup[group.suffix];
            const atsScore = qa?.qa?.score;
            return (
              <div
                key={group.suffix}
                className="flex flex-col rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)] p-4"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--t3)]" />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-[color:var(--t1)]">
                        {group.displayName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[color:var(--t3)]">
                        {group.files.length} {group.files.length === 1 ? "version" : "versions"} ·
                        updated {fmt(group.latestMtime)}
                      </div>
                    </div>
                  </div>
                  {typeof atsScore === "number" && <AtsBadge score={atsScore} />}
                </div>

                {/* Version rows */}
                <div className="mt-3 flex flex-col gap-0.5">
                  {group.files.map((f, i) => (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[color:var(--s2)]"
                    >
                      <VersionBadge version={f.version} latest={i === 0} />
                      <span className="font-num text-[11px] text-[color:var(--t3)]">{fmt(f.mtime)}</span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <button
                          onClick={() => setPreview({ name: f.name, url: f.url })}
                          title="Preview"
                          className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] ${focusRing}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={f.url}
                          download={f.name}
                          title="Download"
                          className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--s3)] hover:text-[color:var(--t1)] ${focusRing}`}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => deleteFile(f.name)}
                          disabled={deleting.has(f.name)}
                          title="Delete this version"
                          className={`flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--t3)] transition-colors hover:bg-[color:var(--red-dim)] hover:text-[color:var(--red)] ${focusRing}`}
                        >
                          {deleting.has(f.name) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-[color:var(--rule)] pt-3">
                  <button
                    onClick={() => toggleQa(group)}
                    title={qa ? "Hide QA review" : "Review ATS score, grammar & fixes"}
                    className={`inline-flex items-center gap-1.5 rounded-md border border-[color:var(--rule)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] ${focusRing}`}
                  >
                    {qa?.busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {qa ? "Hide QA" : "ATS / QA"}
                  </button>
                  <button
                    onClick={() => setUpdateTarget({ group })}
                    title="Regenerate with AI — saves as a new version"
                    className={`inline-flex items-center gap-1.5 rounded-md border border-[color:var(--rule)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] ${focusRing}`}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>

                {/* Inline QA panel */}
                {qa && (
                  <div className="mt-3">
                    <ResumeQaPanel
                      qa={qa.qa}
                      busy={qa.busy}
                      selectable
                      onApply={(instructions) =>
                        setUpdateTarget({ group, initialInstructions: instructions })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
