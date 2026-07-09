"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  Search,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Building2,
  BookmarkPlus,
  PlusCircle,
  X,
  Newspaper,
  Sparkles,
  FileText,
  BarChart3,
  Pencil,
  Trash2,
  Briefcase,
} from "lucide-react";
import type { Job } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  OutreachRecord,
  OutreachStatus,
  EmailCandidate,
  FindEmailResult,
  CompanyEmailEntry,
  CompanyEmailResult,
  ParsedHiringPost,
  TemplateStat,
} from "@/lib/types";

/** One discovered hiring post from POST /api/outreach/scan-posts. */
interface ScannedPost {
  url: string;
  postedAt: string;
  authorName: string;
  authorTitle: string;
  text: string;
  comments: string;
  emails: string[];
  fit?: {
    fits: boolean;
    score: number;
    matched: string[];
    excluded: string[];
    reasons: string[];
    minReq: number | null;
  };
}

const POSTS_PER_PAGE = 6;

// ── cold-mail rich-text helpers: **bold** must render, copy, and reach Gmail ──
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** Render **bold** markdown as real <strong>, preserving line breaks. */
function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}
function stripBold(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*\*/g, "");
}
function boldToHtml(s: string) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}
/** Copy as RICH text (text/html with <strong>) so pasting into Gmail keeps the bold. */
async function richCopy(body: string) {
  const plain = stripBold(body);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([`<div>${boldToHtml(body)}</div>`], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(plain);
  }
}
/** Open Gmail compose pre-filled (creates a draft to review + attach résumé + send). Never sends. */
function openGmailDraft(to: string, subject: string, body: string) {
  const url =
    "https://mail.google.com/mail/?view=cm&fs=1" +
    (to ? `&to=${encodeURIComponent(to)}` : "") +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(stripBold(body))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

const STATUSES: OutreachStatus[] = [
  "drafted",
  "sent",
  "replied",
  "bounced",
  "no_response",
  "closed",
];

function verifyBadge(status: string) {
  if (status === "valid")
    return <Badge variant="success">valid</Badge>;
  if (status === "invalid")
    return <Badge variant="danger">invalid</Badge>;
  if (status === "catch-all")
    return <Badge variant="warning">catch-all</Badge>;
  if (status === "risky" || status === "disposable")
    return <Badge variant="warning">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function Outreach() {
  const [records, setRecords] = useState<OutreachRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Track which emails have already been added to Tracked outreach (per session).
  const [tracked, setTracked] = useState<Set<string>>(new Set());

  // Find/compose tool state.
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"jd_specific" | "speculative">("jd_specific");
  const [jd, setJd] = useState("");
  const [deep, setDeep] = useState(false);

  // Job selector for JD-tailored compose
  const [jobQuery, setJobQuery] = useState("");
  const [jobList, setJobList] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [fetchingJd, setFetchingJd] = useState(false);
  const [fetchJdErr, setFetchJdErr] = useState("");

  // Manual "Add new track" form state.
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addRole, setAddRole] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");

  // Company-wide email scan state.
  const [scanCompany, setScanCompany] = useState("");
  const [scanDomain, setScanDomain] = useState("");
  const [scanDeep, setScanDeep] = useState(false);
  const [scanTargetType, setScanTargetType] = useState<"hr" | "founder">("hr");
  const [scanning, setScanning] = useState(false);
  const [scanRes, setScanRes] = useState<CompanyEmailResult | null>(null);
  const [scanErr, setScanErr] = useState("");

  // ── Hiring-post → cold-mail flow ──
  const [stats, setStats] = useState<TemplateStat[]>([]);
  // Discover posts (Apify).
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<ScannedPost[]>([]);
  const [discoverErr, setDiscoverErr] = useState("");
  const [apifyPage, setApifyPage] = useState(1); // last LinkedIn result page fetched
  const [viewPage, setViewPage] = useState(0); // client-side page index over `discovered`
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPostUrl, setSelectedPostUrl] = useState(""); // post backing the current draft
  // Paste / parse a single post.
  const [postText, setPostText] = useState("");
  const [postComments, setPostComments] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedHiringPost | null>(null);
  const [parseErr, setParseErr] = useState("");
  // Composed draft (from-post) + résumé.
  const [draftBusy, setDraftBusy] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string; templateId: string; templateName: string } | null>(null);
  const [draftErr, setDraftErr] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [postCopied, setPostCopied] = useState(false);
  const [postTracked, setPostTracked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outreach", { cache: "no-store" });
      const json = await res.json();
      const list: OutreachRecord[] = Array.isArray(json.outreach) ? json.outreach : [];
      setRecords(list);
      setStats(Array.isArray(json.templateStats) ? json.templateStats : []);
      // Pre-populate tracked set from persisted records.
      setTracked(new Set(list.map((r) => r.email).filter(Boolean)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);


  // Track any email directly — no compose required.
  const trackEmail = useCallback(async (opts: {
    email: string;
    contactName?: string;
    contactTitle?: string;
    company: string;
    domain?: string;
    verification?: string;
    emailSource?: string;
  }) => {
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: opts.email,
        contactName: opts.contactName || "",
        contactTitle: opts.contactTitle || "",
        company: opts.company,
        domain: opts.domain || "",
        verification: opts.verification || "",
        emailSource: opts.emailSource || "",
        mode: "speculative",
        status: "drafted",
      }),
    });
    setTracked((prev) => { const s = new Set(Array.from(prev)); s.add(opts.email); return s; });
    await load();
  }, [load]);

  const runCompanyScan = useCallback(async () => {
    setScanErr("");
    setScanRes(null);
    if (!scanCompany.trim() && !scanDomain.trim()) {
      setScanErr("Enter a company name or domain.");
      return;
    }
    setScanning(true);
    try {
      const res = await fetch("/api/outreach/find-company-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: scanCompany, domain: scanDomain, deep: scanDeep, targetType: scanTargetType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "scan failed");
      setScanRes(json.result as CompanyEmailResult);
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }, [scanCompany, scanDomain, scanDeep, scanTargetType]);

  // ── Hiring-post flow handlers ──

  const fetchPosts = useCallback(async (page: number): Promise<ScannedPost[]> => {
    const res = await fetch("/api/outreach/scan-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPosts: 20, page, fitOnly: true }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "scan failed");
    return Array.isArray(json.posts) ? (json.posts as ScannedPost[]) : [];
  }, []);

  // Fresh discovery — replaces the list and starts at LinkedIn page 1.
  const runDiscover = useCallback(async () => {
    setDiscoverErr("");
    setDiscovering(true);
    try {
      const posts = await fetchPosts(1);
      setDiscovered(posts);
      setApifyPage(1);
      setViewPage(0);
    } catch (e) {
      setDiscoverErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscovering(false);
    }
  }, [fetchPosts]);

  // Pull the NEXT LinkedIn page and append fresh, profile-fitting posts (dedup is
  // handled server-side via post-scan-history, so this only ever adds new ones).
  const loadMore = useCallback(async () => {
    setDiscoverErr("");
    setLoadingMore(true);
    try {
      const next = apifyPage + 1;
      const posts = await fetchPosts(next);
      setApifyPage(next);
      setDiscovered((prev) => {
        const seen = new Set(prev.map((p) => p.url));
        return [...prev, ...posts.filter((p) => !seen.has(p.url))];
      });
    } catch (e) {
      setDiscoverErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [apifyPage, fetchPosts]);

  const resetDraftState = useCallback(() => {
    setDraft(null); setDraftErr(""); setResumeName(""); setResumeUrl(""); setPostTracked(false);
  }, []);

  const usePost = useCallback((p: ScannedPost) => {
    setPostText(p.text);
    setPostComments(p.comments);
    setSelectedPostUrl(p.url || "");
    setParsed(null); setParseErr("");
    resetDraftState();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resetDraftState]);

  const runParse = useCallback(async () => {
    setParseErr("");
    setParsed(null);
    resetDraftState();
    if (!postText.trim()) { setParseErr("Paste a hiring post first."); return; }
    setParsing(true);
    try {
      const res = await fetch("/api/outreach/parse-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post: postText, comments: postComments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "parse failed");
      setParsed(json.parsed as ParsedHiringPost);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }, [postText, postComments, resetDraftState]);

  const runDraft = useCallback(async () => {
    if (!parsed) return;
    setDraftErr("");
    setDraft(null);
    setPostTracked(false);
    setDraftBusy(true);
    try {
      const res = await fetch("/api/outreach/from-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: parsed.company,
          role: parsed.role,
          requirements: [...parsed.mustHaves, ...parsed.requirements],
          workMode: parsed.workMode,
          mode: "jd_specific",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "compose failed");
      setDraft({ subject: json.subject, body: json.body, templateId: json.templateId, templateName: json.templateName });
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftBusy(false);
    }
  }, [parsed]);

  const genResume = useCallback(async () => {
    if (!parsed) return;
    setResumeBusy(true);
    try {
      const jd = [
        `Role: ${parsed.role}`,
        parsed.location ? `Location: ${parsed.location}` : "",
        parsed.workMode ? `Work mode: ${parsed.workMode}` : "",
        parsed.mustHaves.length ? `Must-haves:\n- ${parsed.mustHaves.join("\n- ")}` : "",
        parsed.requirements.length ? `Requirements:\n- ${parsed.requirements.join("\n- ")}` : "",
      ].filter(Boolean).join("\n");
      const res = await fetch("/api/generate-cv-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Hiring-post résumés are saved in their own folder, separate from the
        // main Resumes library, so post-driven CVs stay grouped together.
        body: JSON.stringify({ jd, company: parsed.company, role: parsed.role, subdir: "resumes-posts" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "résumé generation failed");
      const savedName = res.headers.get("X-Saved-Filename") || "";
      const blob = await res.blob();
      setResumeName(savedName);
      setResumeUrl(URL.createObjectURL(blob));
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : String(e));
    } finally {
      setResumeBusy(false);
    }
  }, [parsed]);

  const trackPost = useCallback(async (sourceUrl: string) => {
    if (!parsed) return;
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: parsed.company,
        role: parsed.role,
        email: parsed.email,
        contactName: parsed.contactName,
        contactTitle: parsed.contactTitle,
        emailSource: "linkedin-post",
        mode: "jd_specific",
        templateId: draft?.templateId || "",
        applyMethod: parsed.applyMethod,
        recruiterType: parsed.recruiterType,
        sourcePostUrl: sourceUrl || "",
        subject: draft?.subject || "",
        resumeFile: resumeName || "",
        status: "drafted",
      }),
    });
    setPostTracked(true);
    if (parsed.email) setTracked((prev) => { const s = new Set(Array.from(prev)); s.add(parsed.email); return s; });
    await load();
  }, [parsed, draft, resumeName, load]);

  const copyDraft = useCallback(() => {
    if (!draft) return;
    richCopy(draft.body); // rich text → bold survives into Gmail
    setPostCopied(true);
    setTimeout(() => setPostCopied(false), 1500);
  }, [draft]);

  // Open a Gmail draft for the hiring-post mail, then log it (with the template) for A/B.
  const createGmailDraftFromPost = useCallback(() => {
    if (!draft) return;
    openGmailDraft(parsed?.email || "", draft.subject, draft.body);
    trackPost(selectedPostUrl);
  }, [draft, parsed, selectedPostUrl, trackPost]);

  const [finding, setFinding] = useState(false);
  const [findRes, setFindRes] = useState<FindEmailResult | null>(null);
  const [findErr, setFindErr] = useState("");
  const [chosen, setChosen] = useState<EmailCandidate | null>(null);

  const [composing, setComposing] = useState(false);
  const [email, setEmail] = useState<{ subject: string; body: string; templateId: string | null; templateName: string | null } | null>(null);
  const [composeErr, setComposeErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [pinnedTemplateId, setPinnedTemplateId] = useState<string | null>(null);
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);

  const runFind = useCallback(async () => {
    setFindErr("");
    setFindRes(null);
    setChosen(null);
    if (!name.trim() || (!company.trim() && !domain.trim())) {
      setFindErr("Enter a name and a company or domain.");
      return;
    }
    setFinding(true);
    try {
      const res = await fetch("/api/outreach/find-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, domain, deep }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "find failed");
      setFindRes(json.result as FindEmailResult);
      const best = (json.result as FindEmailResult).best;
      if (best?.recommended) setChosen(best);
    } catch (e) {
      setFindErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFinding(false);
    }
  }, [name, company, domain, deep]);

  // Load jobs lazily when the selector opens for the first time
  const loadJobsIfNeeded = useCallback(async () => {
    if (jobList.length > 0) return;
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const json = await res.json();
      setJobList(Array.isArray(json.jobs) ? json.jobs : []);
    } catch { /* ignore */ }
  }, [jobList.length]);

  const selectJob = useCallback(async (job: Job) => {
    setSelectedJob(job);
    setJobQuery(`${job.company} — ${job.role}`);
    setCompany(job.company);
    setRole(job.role);
    setMode("jd_specific");
    setJd("");
    setFetchJdErr("");
    if (!job.url) return;
    setFetchingJd(true);
    try {
      const res = await fetch("/api/outreach/fetch-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: job.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fetch failed");
      setJd(json.jd || "");
    } catch (e) {
      setFetchJdErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFetchingJd(false);
    }
  }, []);

  const runCompose = useCallback(async () => {
    setComposeErr("");
    setEmail(null);
    if (!company.trim()) {
      setComposeErr("Company is required to compose.");
      return;
    }
    setComposing(true);
    try {
      const res = await fetch("/api/outreach/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, personName: name, personTitle: title, jd, mode, templateId: pinnedTemplateId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "compose failed");
      setEmail({ subject: json.subject, body: json.body, templateId: json.templateId ?? null, templateName: json.templateName ?? null });
    } catch (e) {
      setComposeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setComposing(false);
    }
  }, [company, role, name, title, jd, mode]);

  const logOutreach = useCallback(async () => {
    if (!company.trim()) return;
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        role,
        domain: findRes?.domain || domain,
        contactName: name,
        contactTitle: title,
        email: chosen?.email || "",
        emailSource: chosen?.sources?.join(", ") || "",
        verification: chosen?.verification?.status || "",
        mode,
        subject: email?.subject || "",
        templateId: email?.templateId || "",
        status: "drafted",
      }),
    });
    await load();
  }, [company, role, domain, name, title, chosen, email, mode, findRes, load]);

  const setStatus = useCallback(async (id: string, status: OutreachStatus) => {
    await fetch("/api/outreach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }, [load]);

  // ── Tracked outreach: full edit + delete (completes CRUD) ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<OutreachRecord>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const startEdit = useCallback((r: OutreachRecord) => {
    setEditingId(r.id);
    setEditVals({
      email: r.email, company: r.company, role: r.role,
      contactName: r.contactName, note: r.note, followUpDate: r.followUpDate,
    });
  }, []);
  const cancelEdit = useCallback(() => { setEditingId(null); setEditVals({}); }, []);

  const saveEdit = useCallback(async (id: string) => {
    setRowBusy(id);
    try {
      await fetch("/api/outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch: editVals }),
      });
      setEditingId(null);
      setEditVals({});
      await load();
    } finally {
      setRowBusy(null);
    }
  }, [editVals, load]);

  const removeRecord = useCallback(async (id: string, email?: string) => {
    if (typeof window !== "undefined" &&
      !window.confirm("Delete this tracked outreach? This cannot be undone.")) return;
    setRowBusy(id);
    try {
      await fetch("/api/outreach", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (email) setTracked((prev) => { const s = new Set(Array.from(prev)); s.delete(email); return s; });
      await load();
    } finally {
      setRowBusy(null);
    }
  }, [load]);

  async function addTrack() {
    const email = addEmail.trim();
    const co = addCompany.trim();
    if (!email || !co) { setAddErr("Email and company are required."); return; }
    setAddBusy(true);
    setAddErr("");
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          company: co,
          role: addRole.trim(),
          domain: "",
          contactName: "",
          contactTitle: "",
          emailSource: "manual",
          verification: "",
          mode: "speculative",
          subject: "",
          status: "drafted",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setTracked((prev) => { const s = new Set(Array.from(prev)); s.add(email); return s; });
      setAddEmail(""); setAddCompany(""); setAddRole("");
      setAddOpen(false);
      await load();
    } catch (e) {
      setAddErr((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  const copyEmail = useCallback(() => {
    if (!email) return;
    richCopy(email.body); // rich text → bold survives into Gmail
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [email]);

  // Open a Gmail draft for the find-email compose flow, then log the outreach.
  const createGmailDraftCompose = useCallback(() => {
    if (!email) return;
    openGmailDraft(chosen?.email || "", email.subject, email.body);
    logOutreach();
  }, [email, chosen, logOutreach]);

  const dueCount = useMemo(
    () => records.filter(
      (r) => r.status === "sent" && r.followUpDate &&
        r.followUpDate <= new Date().toISOString().slice(0, 10)
    ).length,
    [records]
  );

  // Reusable Track button shown in both email lists.
  function TrackBtn({ entry, co, dom }: {
    entry: { email: string; name?: string | null; title?: string | null; verification?: { status: string }; sources?: string[] };
    co: string;
    dom?: string;
  }) {
    const isTracked = tracked.has(entry.email);
    return isTracked ? (
      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--success))]">
        <Check className="h-3.5 w-3.5" /> Tracked
      </span>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => trackEmail({
          email: entry.email,
          contactName: entry.name ?? undefined,
          contactTitle: entry.title ?? undefined,
          company: co,
          domain: dom,
          verification: entry.verification?.status,
          emailSource: entry.sources?.join(", "),
        })}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        Track
      </Button>
    );
  }

  const fmtPercent = (n: number) => `${n}%`;

  // Client-side pagination over the posts already fetched.
  const totalPostPages = Math.max(1, Math.ceil(discovered.length / POSTS_PER_PAGE));
  const safeViewPage = Math.min(viewPage, totalPostPages - 1);
  const pagePosts = discovered.slice(
    safeViewPage * POSTS_PER_PAGE,
    safeViewPage * POSTS_PER_PAGE + POSTS_PER_PAGE
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-medium tracking-tight text-[color:var(--t1)]">Outreach</h2>
          <p className="mt-0.5 text-[13px] text-[color:var(--t2)]">
            {records.length} tracked · turn hiring posts and contacts into tailored cold mail.
            Nothing is ever sent automatically.
          </p>
        </div>
        {dueCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
            style={{ color: "var(--amber)", background: "var(--amber-dim)" }}
          >
            {dueCount} follow-up{dueCount === 1 ? "" : "s"} due
          </span>
        )}
      </div>

      {/* ── Hiring posts → cold mail ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Hiring posts → cold mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Turn a recruiter&apos;s &quot;we&apos;re hiring — send your CV to …&quot; post into a tailored
            résumé + a draft cold mail. Discover posts automatically (Apify), or paste one below.
            The apply email is often in the first comment — paste that too. Nothing is ever sent.
          </p>

          {/* Auto-discover */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={runDiscover} disabled={discovering}>
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Discover from LinkedIn
            </Button>
            <span className="text-xs text-muted-foreground">
              Off-account search via Apify (~$0.002/post). Needs APIFY_TOKEN in .env.
            </span>
          </div>
          {discoverErr && <p className="text-sm text-[hsl(var(--danger))]">{discoverErr}</p>}
          {discovered.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">
                {discovered.length} profile-fitting post{discovered.length !== 1 ? "s" : ""} (filtered by your roles, skills &amp; experience) ·
                showing {safeViewPage * POSTS_PER_PAGE + 1}–{Math.min(discovered.length, (safeViewPage + 1) * POSTS_PER_PAGE)}
              </p>
              {pagePosts.map((p) => (
                <div key={p.url} className="flex items-start justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {p.fit && (
                        <span className={`font-num font-medium ${
                          p.fit.score >= 60 ? "text-[hsl(var(--success))]" : p.fit.score >= 30 ? "text-[hsl(var(--warning))]" : "text-muted-foreground"
                        }`}>fit {p.fit.score}</span>
                      )}
                      <span className="truncate font-medium">{p.authorName || "Recruiter"}{p.authorTitle ? ` — ${p.authorTitle}` : ""}</span>
                    </div>
                    <div className="truncate text-muted-foreground">{p.text.slice(0, 120)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {p.emails.map((e) => <Badge key={e} variant="outline" className="font-mono">{e}</Badge>)}
                      {p.fit?.matched.slice(0, 5).map((s) => <Badge key={s} variant="accent">{s}</Badge>)}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-primary underline">View on LinkedIn ↗</a>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => usePost(p)}>Use</Button>
                </div>
              ))}
              {/* Pagination + fetch-more */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={safeViewPage === 0} onClick={() => setViewPage((v) => Math.max(0, v - 1))}>Prev</Button>
                  <span className="text-xs text-muted-foreground">Page {safeViewPage + 1} of {totalPostPages}</span>
                  <Button size="sm" variant="outline" disabled={safeViewPage >= totalPostPages - 1} onClick={() => setViewPage((v) => v + 1)}>Next</Button>
                </div>
                <Button size="sm" variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Load more from LinkedIn
                </Button>
              </div>
            </div>
          )}

          {/* Paste a post */}
          <div className="space-y-2">
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-background/40 p-2.5 text-sm outline-none focus:border-primary"
              placeholder="Paste the LinkedIn hiring post text here…"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
            />
            <textarea
              className="min-h-16 w-full rounded-md border border-border bg-background/40 p-2.5 text-sm outline-none focus:border-primary"
              placeholder="Optional: paste the first comment(s) — the apply email is often here."
              value={postComments}
              onChange={(e) => setPostComments(e.target.value)}
            />
            <Button onClick={runParse} disabled={parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Parse post
            </Button>
          </div>
          {parseErr && <p className="text-sm text-[hsl(var(--danger))]">{parseErr}</p>}

          {/* Parsed fields */}
          {parsed && (
            <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Company</span>
                  <Input value={parsed.company} onChange={(e) => setParsed({ ...parsed, company: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Role</span>
                  <Input value={parsed.role} onChange={(e) => setParsed({ ...parsed, role: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Apply email</span>
                  <Input value={parsed.email} onChange={(e) => setParsed({ ...parsed, email: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Work mode</span>
                  <Input value={parsed.workMode} onChange={(e) => setParsed({ ...parsed, workMode: e.target.value as ParsedHiringPost["workMode"] })} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{parsed.applyMethod}</Badge>
                <Badge variant="outline">{parsed.recruiterType}</Badge>
                {parsed.location && <span>{parsed.location}</span>}
                {parsed.salary && <span>· {parsed.salary}</span>}
                <span>· confidence {Math.round(parsed.confidence * 100)}%</span>
              </div>
              {parsed.mustHaves.length > 0 && (
                <p className="text-xs text-muted-foreground"><b className="text-foreground">Must-haves:</b> {parsed.mustHaves.join(", ")}</p>
              )}
              {parsed.applyMethod !== "email" && !parsed.email && (
                <p className="text-xs text-[hsl(var(--warning))]">
                  No apply email in this post (applies via {parsed.applyMethod}). Use &quot;Find email&quot; below or apply through their stated method.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={runDraft} disabled={draftBusy}>
                  {draftBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Generate draft (auto-picks template)
                </Button>
                <Button size="sm" variant="secondary" onClick={genResume} disabled={resumeBusy}>
                  {resumeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Generate résumé
                </Button>
                {resumeUrl && (
                  <a href={resumeUrl} download={resumeName || "resume.pdf"} className="text-xs text-primary underline">
                    {resumeName || "résumé.pdf"}
                  </a>
                )}
              </div>
            </div>
          )}
          {draftErr && <p className="text-sm text-[hsl(var(--danger))]">{draftErr}</p>}

          {/* Composed draft */}
          {draft && (
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium">
                  Subject: <span className="font-normal">{draft.subject}</span>
                </p>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">template: {draft.templateName}</Badge>
                  <Button variant="ghost" size="sm" onClick={copyDraft}>
                    {postCopied ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                    {postCopied ? "Copied" : "Copy"}
                  </Button>
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                <BoldText text={draft.body} />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={createGmailDraftFromPost} disabled={!parsed?.email}>
                  <Mail className="h-3.5 w-3.5" /> Create Gmail draft
                </Button>
                {postTracked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--success))]">
                    <Check className="h-3.5 w-3.5" /> Tracked (template logged for A/B)
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => trackPost(selectedPostUrl)} disabled={!parsed?.company}>
                    Track only
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  Opens Gmail pre-filled — review, attach your résumé, then send. Nothing is sent automatically.
                </span>
              </div>
            </div>
          )}

          {/* A/B template stats */}
          {stats.some((s) => s.total > 0) && (
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" /> Template A/B — reply rate
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-muted-foreground">
                    <tr><th className="pb-1 pr-3">Template</th><th className="pb-1 pr-3">Used</th><th className="pb-1 pr-3">Sent</th><th className="pb-1 pr-3">Replied</th><th className="pb-1">Reply rate</th></tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.templateId} className="border-t border-border">
                        <td className="py-1 pr-3">{s.name}</td>
                        <td className="py-1 pr-3 font-num">{s.total}</td>
                        <td className="py-1 pr-3 font-num">{s.sent + s.replied + s.no_response + s.bounced}</td>
                        <td className="py-1 pr-3 font-num">{s.replied}</td>
                        <td className="py-1 font-num font-medium">{fmtPercent(s.replyRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Company email scan ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Company email scan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {scanTargetType === "hr"
              ? "Find HR and hiring-related contacts — recruiters, talent acquisition, people ops, HR managers, CHRO/CPO — ranked by confidence."
              : "Find founders, CEOs, CTOs and other C-suite / leadership contacts — ideal for cold outreach at startups where decisions happen at the top."}
            {" "}Track any email directly to the Tracked outreach list below.
          </p>

          {/* Target type toggle */}
          <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5 text-sm">
            <button
              className={`rounded px-3 py-1.5 transition-colors ${
                scanTargetType === "hr"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setScanTargetType("hr"); setScanRes(null); }}
            >
              HR / Recruiter
            </button>
            <button
              className={`rounded px-3 py-1.5 transition-colors ${
                scanTargetType === "founder"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setScanTargetType("founder"); setScanRes(null); }}
            >
              Founder / CEO
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Input
              className="min-w-48 flex-1"
              placeholder="Company (e.g. Razorpay)"
              value={scanCompany}
              onChange={(e) => setScanCompany(e.target.value)}
            />
            <Input
              className="min-w-48 flex-1"
              placeholder="Domain (optional, e.g. razorpay.com)"
              value={scanDomain}
              onChange={(e) => setScanDomain(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runCompanyScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {scanning ? "Scanning… (may take up to 60s)" : "Scan company"}
            </Button>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={scanDeep} onChange={(e) => setScanDeep(e.target.checked)} />
              deep verify (uses Bouncer credits)
            </label>
          </div>

          {scanErr && <p className="text-sm text-[hsl(var(--danger))]">{scanErr}</p>}

          {scanRes && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>Domain: <b className="text-foreground">{scanRes.domain || "—"}</b></span>
                {scanRes.organization && <span>Org: <b className="text-foreground">{scanRes.organization}</b></span>}
                {!scanRes.quotaExceeded && (
                  <>
                    {scanRes.pattern && <span>Pattern: <b className="text-foreground">{scanRes.pattern}</b></span>}
                    <span className="text-foreground">
                      <b>{scanRes.candidates.length}</b> {scanTargetType === "founder" ? "leadership" : "HR"} contacts
                    </span>
                    {scanRes.totalHr > scanRes.candidates.length && (
                      <span className="text-xs">
                        ({scanRes.totalHr} {scanTargetType === "founder" ? "leadership" : "HR"} of {scanRes.totalIndexed} total indexed)
                      </span>
                    )}
                  </>
                )}
                {scanRes.acceptAll && (
                  <Badge variant="warning" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> catch-all
                  </Badge>
                )}
                {scanRes.steps.includes("clearbit:domain-resolve") && (
                  <Badge variant="outline" className="text-xs">domain via Clearbit</Badge>
                )}
                {scanRes.linkedInFallback && (
                  <Badge variant="outline" className="text-xs gap-1">LinkedIn + SMTP fallback</Badge>
                )}
              </div>

              {scanRes.quotaExceeded ? (
                <div className="space-y-1.5">
                  <p className="text-[hsl(var(--warning))]">
                    Hunter.io quota exhausted — LinkedIn search also returned no results.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Options: add the domain manually above and use <b>"Find email"</b> below with a specific recruiter name, or wait for Hunter quota to reset (resets on the 24th). Add more Hunter keys via <code>HUNTER_IO_API_KEY_2</code> in <code>.env</code> for extra capacity.
                  </p>
                </div>
              ) : scanRes.candidates.length === 0 ? (
                <p className="text-muted-foreground">
                  {scanRes.linkedInFallback
                    ? `LinkedIn search found ${scanRes.totalIndexed} HR contact${scanRes.totalIndexed !== 1 ? "s" : ""} but none had a deliverable email — domain may be catch-all or block SMTP probing. Try "Find email" below with a specific recruiter name.`
                    : scanRes.totalIndexed > 0
                      ? scanTargetType === "founder"
                        ? `Hunter found ${scanRes.totalIndexed} email${scanRes.totalIndexed !== 1 ? "s" : ""} but none matched founder/leadership titles. Try "Find email" below with a specific person's name.`
                        : `Hunter found ${scanRes.totalIndexed} email${scanRes.totalIndexed !== 1 ? "s" : ""} but none matched HR/hiring titles. Try "Find email" below with a specific recruiter's name.`
                      : `No emails indexed for this domain yet. Try adding the domain manually or use "Find email" below with a specific recruiter name.`}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left uppercase text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3">Email</th>
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Title</th>
                        <th className="pb-2 pr-3">Confidence</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {scanRes.candidates.map((c) => (
                        <tr key={c.email} className="border-t border-border">
                          <td className="py-1.5 pr-3 font-mono">{c.email}</td>
                          <td className="py-1.5 pr-3">{c.name || "—"}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{c.title || "—"}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`font-num font-medium ${
                              c.confidence >= 80 ? "text-[hsl(var(--success))]"
                              : c.confidence >= 50 ? "text-[hsl(var(--warning))]"
                              : "text-muted-foreground"
                            }`}>
                              {c.confidence}%
                            </span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className="flex items-center gap-1">
                              {c.recommended
                                ? <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                                : <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />}
                              {verifyBadge(c.verification.status)}
                              {c.verification.roleBased && <Badge variant="outline">role</Badge>}
                            </span>
                          </td>
                          <td className="py-1.5">
                            <TrackBtn
                              entry={{ ...c, name: c.name, title: c.title }}
                              co={scanRes.company || scanCompany}
                              dom={scanRes.domain ?? undefined}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Find email & compose ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Cold outreach — find an email & draft
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input placeholder="Person name (e.g. Jane Doe)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input placeholder="Domain (optional, e.g. acme.com)" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <Input placeholder="Role (e.g. DevOps Engineer)" value={role} onChange={(e) => setRole(e.target.value)} />
            <Input placeholder="Their title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={mode} onChange={(e) => setMode(e.target.value as "jd_specific" | "speculative")}>
              <option value="jd_specific">Mode: applying to an opening</option>
              <option value="speculative">Mode: speculative (no opening)</option>
            </Select>
          </div>

          {/* Job selector — pick from existing scanned jobs to auto-fetch the JD */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" />
              Select a job to tailor the cold mail to its JD
              <span className="opacity-50">(optional)</span>
            </label>
            <div data-job-selector>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search by company or role…"
                  value={jobQuery}
                  onFocus={() => loadJobsIfNeeded()}
                  onChange={(e) => {
                    setJobQuery(e.target.value);
                    if (!e.target.value.trim()) { setSelectedJob(null); setJd(""); setFetchJdErr(""); }
                  }}
                />
                {(selectedJob || jobQuery) && (
                  <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => {
                    setSelectedJob(null); setJobQuery(""); setJd(""); setFetchJdErr("");
                  }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Inline results — hidden once a job is selected */}
              {jobQuery.trim() && !selectedJob && (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-card">
                  {jobList.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-muted-foreground">Loading jobs…</p>
                  ) : (() => {
                    const q = jobQuery.toLowerCase().trim();
                    const matches = jobList
                      .filter((j) => j.url && (
                        j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q)
                      ))
                      .sort((a, b) => (b.firstSeen || "").localeCompare(a.firstSeen || ""))
                      .slice(0, 40);
                    return matches.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-muted-foreground">No jobs match "{q}".</p>
                    ) : (
                      <>
                        <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
                          {matches.length} match{matches.length !== 1 ? "es" : ""} — most recent first
                        </p>
                        {matches.map((j) => (
                          <button
                            key={j.url}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => selectJob(j)}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-medium">{j.company}</span>
                              <span className="text-muted-foreground"> — {j.role}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {j.firstSeen && <span className="text-xs text-muted-foreground">{j.firstSeen.slice(0, 10)}</span>}
                              {j.portal && <Badge variant="outline" className="text-xs">{j.portal}</Badge>}
                            </span>
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            {fetchingJd && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Fetching JD…
              </p>
            )}
            {!fetchingJd && selectedJob && jd && (
              <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--success))]">
                <Check className="h-3 w-3" /> JD loaded ({jd.length} chars) — cold mail will be tailored to this role
              </p>
            )}
            {fetchJdErr && (
              <p className="text-xs text-[hsl(var(--warning))]">{fetchJdErr} — mail will use role name only.</p>
            )}
          </div>

          {/* Template picker — 5 archetypes; "auto" lets A/B rotation decide */}
          {(() => {
            const TEMPLATE_META = [
              {
                id: null,
                label: "Auto",
                technique: "A/B rotation",
                bestFor: "Picks the least-used template automatically for balanced reply-rate data",
                sample: null,
              },
              {
                id: "direct-match",
                label: "Direct Role-Match",
                technique: "Classic direct application — clarity over cleverness",
                bestFor: "In-house recruiters / TA who posted a specific role with a clear JD",
                sample: `Hi [Name],\n\nI'm reaching out regarding the DevOps Engineer role at [Company].\n\nI bring 4+ years with Kubernetes + CI/CD pipelines, having managed 50+ microservices at scale. Your requirement for AWS EKS experience aligns directly with my current stack.\n\nI've attached my résumé — happy to do a quick call.`,
              },
              {
                id: "proof-first",
                label: "Proof-First (AIDA)",
                technique: "Lead with a quantified result as the attention hook",
                bestFor: "Engineering managers and founders who respond to impact metrics",
                sample: `Hi [Name],\n\nI reduced deployment failures by 60% and cut infra costs by ₹12L/year at my current role.\n\nI achieved this on AWS + Terraform at a 200-engineer org — the same scale your JD describes. That track record maps directly to the DevOps Engineer opening.\n\nRésumé attached — open to a quick 15-min chat?`,
              },
              {
                id: "problem-solution",
                label: "Problem-Solution (PAS)",
                technique: "Problem → Agitate → Solve — name the pain the role implies",
                bestFor: "Startup founders / CTOs, small teams, and speculative outreach",
                sample: `Hi [Name],\n\nGrowing engineering teams often hit reliability gaps before on-call processes are mature.\n\nThat friction compounds fast as deploys increase past 20 engineers.\n\nI've solved this before — reduced MTTR by 40% and built runbook infra from scratch. Would a 15-min call on how I'd approach this be useful?`,
              },
              {
                id: "warm-hook",
                label: "Warm-Hook",
                technique: "Personalisation-led — open with a genuine, specific hook",
                bestFor: "Any recipient when a real hook exists (the post itself, shared tool, company news)",
                sample: `Hi [Name],\n\nI saw your post this week about building out the DevOps team — the CI reliability challenge you described is exactly the problem I've spent 3 years solving.\n\nI'm a DevOps Engineer with strong Kubernetes/GitOps experience and a proven record of cutting pipeline failures by 60%.\n\nI've attached my résumé — is this the right place to send it, or is there a better contact?`,
              },
              {
                id: "soft-ask",
                label: "Soft-Ask",
                technique: "Permission / low-pressure question — ultra-short, mobile-readable",
                bestFor: "Busy recruiters, agency recruiters, high-volume posts",
                sample: `Hi [Name],\n\nI noticed you're hiring a DevOps Engineer and wanted to reach out.\n\nI'm a DevOps Engineer with 4 years of Kubernetes and AWS experience — available to join immediately.\n\nIs this the right address to send my CV for the DevOps Engineer role? Happy to share it.`,
              },
            ] as { id: string | null; label: string; technique: string; bestFor: string; sample: string | null }[];

            const activeId = hoveredTemplateId !== null ? hoveredTemplateId : pinnedTemplateId;
            const activeMeta = TEMPLATE_META.find((t) => t.id === activeId) ?? null;

            return (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Email template <span className="opacity-60">(auto = A/B rotation picks the least-used)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_META.map((t) => (
                    <button
                      key={t.id ?? "auto"}
                      onClick={() => setPinnedTemplateId(t.id)}
                      onMouseEnter={() => setHoveredTemplateId(t.id)}
                      onMouseLeave={() => setHoveredTemplateId(null)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        pinnedTemplateId === t.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Preview card — shown on hover or when a template is pinned */}
                {activeMeta && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{activeMeta.label}</span>
                      <span className="text-muted-foreground opacity-70">·</span>
                      <span className="text-muted-foreground italic">{activeMeta.technique}</span>
                    </div>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground/70">Best for:</span> {activeMeta.bestFor}
                    </p>
                    {activeMeta.sample ? (
                      <div className="rounded border border-border bg-background/60 px-3 py-2.5">
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/50">Sample structure</p>
                        <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{activeMeta.sample}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">AI will choose the least-used template from your outreach history for balanced A/B data.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runFind} disabled={finding}>
              {finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find email
            </Button>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
              deep verify (Bouncer)
            </label>
            <Button variant="secondary" onClick={runCompose} disabled={composing}>
              {composing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Compose email
            </Button>
          </div>

          {findErr && <p className="text-sm text-[hsl(var(--danger))]">{findErr}</p>}

          {findRes && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                <span>Domain: <b className="text-foreground">{findRes.domain || "—"}</b></span>
                <span>· Pattern: <b className="text-foreground">{findRes.pattern || "unknown"}</b></span>
                {findRes.acceptAll && (
                  <Badge variant="warning" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> catch-all domain
                  </Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {findRes.candidates.map((c) => (
                  <div
                    key={c.email}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 transition-colors ${
                      chosen?.email === c.email ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    {/* Left: select this email as chosen */}
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setChosen(c)}
                    >
                      {c.recommended
                        ? <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
                        : <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="font-mono text-xs">{c.email}</span>
                      {c.verification.roleBased && <Badge variant="outline">role</Badge>}
                    </button>

                    {/* Right: verify badge + confidence + Track */}
                    <span className="flex shrink-0 items-center gap-2">
                      {verifyBadge(c.verification.status)}
                      <span className="font-num text-xs text-muted-foreground">{c.confidence}%</span>
                      <TrackBtn
                        entry={c}
                        co={company || findRes.company || ""}
                        dom={findRes.domain ?? undefined}
                      />
                    </span>
                  </div>
                ))}
                {!findRes.candidates.length && (
                  <p className="text-muted-foreground">No candidates found.</p>
                )}
              </div>
              {findRes.best && !findRes.best.recommended && (
                <p className="mt-2 text-xs text-[hsl(var(--warning))]">
                  No address verified "valid" — don't cold-email a guess. Try deep verify or the Gmail people-chip check.
                </p>
              )}
            </div>
          )}

          {composeErr && <p className="text-sm text-[hsl(var(--danger))]">{composeErr}</p>}

          {email && (
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">
                  Subject: <span className="font-normal">{email.subject}</span>
                </p>
                <div className="flex items-center gap-2">
                  {email.templateName && (
                    <Badge variant="outline" className="text-xs">template: {email.templateName}</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={copyEmail}>
                    {copied ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                <BoldText text={email.body} />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={createGmailDraftCompose} disabled={!chosen?.email}>
                  <Mail className="h-3.5 w-3.5" /> Create Gmail draft
                </Button>
                <Button size="sm" variant="outline" onClick={logOutreach} disabled={!company.trim()}>
                  Track only
                </Button>
                <span className="text-xs text-muted-foreground">
                  Opens Gmail pre-filled — review, attach your résumé, then send. Nothing is sent automatically.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tracked outreach ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tracked outreach</span>
            <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              {dueCount > 0 && <Badge variant="warning">{dueCount} follow-up due</Badge>}
              <span className="font-num">{records.length}</span>
              <Button size="sm" variant="outline" onClick={() => { setAddOpen((o) => !o); setAddErr(""); }}>
                {addOpen ? <X className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
                {addOpen ? "Cancel" : "Add"}
              </Button>
            </span>
          </CardTitle>
          {addOpen && (
            <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="HR email *"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="h-8 w-56 text-sm"
                />
                <Input
                  placeholder="Company *"
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  className="h-8 w-40 text-sm"
                />
                <Input
                  placeholder="Role (optional)"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="h-8 w-44 text-sm"
                />
                <Button size="sm" onClick={addTrack} disabled={addBusy}>
                  {addBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {addBusy ? "Saving…" : "Save"}
                </Button>
              </div>
              {addErr && <p className="text-xs text-[hsl(var(--danger))]">{addErr}</p>}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outreach tracked yet. Click Track on any email above to add it here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Verify</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Follow-up</th>
                    <th className="py-2 pr-3">Note</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const editing = editingId === r.id;
                    const busy = rowBusy === r.id;
                    return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {editing ? (
                          <Input
                            value={editVals.email ?? ""}
                            onChange={(e) => setEditVals((v) => ({ ...v, email: e.target.value }))}
                            className="h-8 w-48 text-xs"
                          />
                        ) : (r.email || "—")}
                      </td>
                      <td className="py-2 pr-3">
                        {editing ? (
                          <Input
                            value={editVals.company ?? ""}
                            onChange={(e) => setEditVals((v) => ({ ...v, company: e.target.value }))}
                            className="h-8 w-36 text-sm"
                          />
                        ) : r.company}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {editing ? (
                          <Input
                            value={editVals.role ?? ""}
                            onChange={(e) => setEditVals((v) => ({ ...v, role: e.target.value }))}
                            className="h-8 w-40 text-sm"
                          />
                        ) : (r.role || "—")}
                      </td>
                      <td className="py-2 pr-3">{r.verification ? verifyBadge(r.verification) : "—"}</td>
                      <td className="py-2 pr-3">
                        <Select
                          value={r.status}
                          onChange={(e) => setStatus(r.id, e.target.value as OutreachStatus)}
                          className="h-8 w-36"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {editing ? (
                          <Input
                            type="date"
                            value={editVals.followUpDate ?? ""}
                            onChange={(e) => setEditVals((v) => ({ ...v, followUpDate: e.target.value }))}
                            className="h-8 w-36 text-xs"
                          />
                        ) : (
                          <>
                            {r.followUpDate || "—"}
                            {r.status === "sent" && r.followUpDate &&
                              r.followUpDate <= new Date().toISOString().slice(0, 10) && (
                              <Badge variant="warning" className="ml-1">due</Badge>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {editing ? (
                          <Input
                            value={editVals.note ?? ""}
                            onChange={(e) => setEditVals((v) => ({ ...v, note: e.target.value }))}
                            placeholder="note…"
                            className="h-8 w-40 text-xs"
                          />
                        ) : (
                          <span className="line-clamp-1 max-w-[12rem]" title={r.note}>{r.note || "—"}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {editing ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => saveEdit(r.id)} disabled={busy} title="Save">
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={busy} title="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => startEdit(r)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => removeRecord(r.id, r.email)} disabled={busy} title="Delete">
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
