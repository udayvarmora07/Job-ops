"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Trash2,
  Plus,
  RefreshCw,
  ClipboardCheck,
  Loader2,
  Inbox,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineEntry {
  url: string;
  company: string;
  role: string;
  hasJd?: boolean;
}

interface EvalState {
  busy: boolean;
  result: string | null;
  error: string | null;
}

export function PipelineManager({
  onSaved,
}: {
  onSaved?: () => Promise<void> | void;
}) {
  const [pending, setPending] = useState<PipelineEntry[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [urlInput, setUrlInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addInfo, setAddInfo] = useState<string | null>(null);
  const [jdInput, setJdInput] = useState("");
  const [needsManualJd, setNeedsManualJd] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [evalStates, setEvalStates] = useState<Record<string, EvalState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline");
      const data = await res.json();
      setPending(data.pending || []);
      setProcessedCount(data.processedCount || 0);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveMeta(url: string) {
    if (!url.startsWith("http")) return;
    setFetchingMeta(true);
    try {
      const res = await fetch("/api/pipeline/fetch-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setDetectedPlatform(data.platform || null);
      if (data.title && !roleInput.trim()) setRoleInput(data.title);
      if (data.company && !companyInput.trim()) setCompanyInput(data.company);
      if (data.location && !locationInput.trim()) setLocationInput(data.location);
    } catch {
      /* silent */
    } finally {
      setFetchingMeta(false);
    }
  }

  function resetAddForm() {
    setUrlInput("");
    setCompanyInput("");
    setRoleInput("");
    setLocationInput("");
    setJdInput("");
    setNeedsManualJd(false);
    setDetectedPlatform(null);
  }

  // force=true adds the job even when the JD couldn't be fetched (stub, no JD).
  async function addUrl(force = false) {
    const url = urlInput.trim();
    if (!url) return;
    setAdding(true);
    setAddError(null);
    setAddInfo(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          company: companyInput.trim() || undefined,
          role: roleInput.trim() || undefined,
          location: locationInput.trim() || undefined,
          jd: jdInput.trim() || undefined,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 422 + needsManualJd → auto-fetch was blocked; reveal the paste box.
        if (data.needsManualJd) setNeedsManualJd(true);
        setAddError(data.error || "Failed to add URL.");
        return;
      }
      const src = data.jdSource as string | undefined;
      if (data.warning) {
        setAddInfo(`Added without a JD — ${data.warning}`);
      } else if (src === "manual") {
        setAddInfo(`Added ✓ JD saved from your paste (${data.jdChars} chars).`);
      } else if (src && src !== "none") {
        setAddInfo(`Added ✓ Full JD fetched via ${src} (${data.jdChars} chars).`);
      } else {
        setAddInfo("Added ✓");
      }
      resetAddForm();
      await load();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteEntry(url: string) {
    setDeletingUrl(url);
    try {
      await fetch("/api/pipeline", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      await load();
    } finally {
      setDeletingUrl(null);
    }
  }

  async function evaluateEntry(e: PipelineEntry) {
    setEvalStates((prev) => ({
      ...prev,
      [e.url]: { busy: true, result: null, error: null },
    }));
    try {
      // Prefer the full JD captured at add-time; fall back to a header stub.
      let storedJd = "";
      try {
        const jr = await fetch(`/api/pipeline?jd=${encodeURIComponent(e.url)}`);
        if (jr.ok) storedJd = (await jr.json()).jd || "";
      } catch {
        /* fall back to stub */
      }
      const header = [
        e.role ? `Role: ${e.role}` : "",
        e.company ? `Company: ${e.company}` : "",
        `URL: ${e.url}`,
      ]
        .filter(Boolean)
        .join("\n");
      const brief = storedJd ? `${header}\n\n${storedJd}` : header;

      const res = await fetch("/api/evaluate-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: brief }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEvalStates((prev) => ({
          ...prev,
          [e.url]: { busy: false, result: null, error: data.error || "Evaluation failed." },
        }));
        return;
      }
      setEvalStates((prev) => ({
        ...prev,
        [e.url]: {
          busy: false,
          result: `Saved report #${data.num} · ${data.company} — ${data.role} (${data.score})`,
          error: null,
        },
      }));
      await onSaved?.();
    } catch (err) {
      setEvalStates((prev) => ({
        ...prev,
        [e.url]: { busy: false, result: null, error: (err as Error).message },
      }));
    }
  }

  const q = searchQ.trim().toLowerCase();
  const filteredPending = q
    ? pending.filter(
        (e) =>
          e.company.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          e.url.toLowerCase().includes(q)
      )
    : pending;

  return (
    <div className="space-y-4">
      {/* Add URL form */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          Add Job URL to Pipeline
        </h3>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Input
              placeholder="Paste LinkedIn, Naukri, Indeed or any job URL…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text").trim();
                if (pasted) setTimeout(() => resolveMeta(pasted), 0);
              }}
              onBlur={() => resolveMeta(urlInput.trim())}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              className="pr-8"
            />
            {fetchingMeta && (
              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Input
            placeholder="Company (auto-filled)"
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Role (auto-filled)"
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Location (optional)"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            className="w-36"
          />
          <Button onClick={() => addUrl()} disabled={adding || !urlInput.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
        {detectedPlatform && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] capitalize">
              {detectedPlatform}
            </Badge>
            {(companyInput || roleInput) ? "Auto-filled from URL — edit if needed." : "Detected platform. Fill company & role if known."}
          </p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          Adding fetches the full job description automatically. LinkedIn, Greenhouse, Lever,
          Ashby &amp; most company pages work directly; Indeed &amp; company SPAs via headless
          render; Naukri/Instahyre need a manual paste.
        </p>

        {/* JD paste box — revealed when auto-fetch is blocked, or on demand. */}
        {needsManualJd && (
          <div className="mt-3 rounded-md border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger))]/5 p-3">
            <p className="mb-2 text-xs font-medium text-[hsl(var(--danger))]">
              Couldn&apos;t auto-fetch the JD for this URL. Paste the full job description
              below and Add again — or Add anyway without a JD.
            </p>
            <textarea
              value={jdInput}
              onChange={(e) => setJdInput(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={8}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={() => addUrl()} disabled={adding || jdInput.trim().length < 120}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add with pasted JD
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addUrl(true)} disabled={adding}>
                Add anyway (no JD)
              </Button>
              {jdInput.trim().length > 0 && jdInput.trim().length < 120 && (
                <span className="text-xs text-muted-foreground">
                  {120 - jdInput.trim().length} more chars needed
                </span>
              )}
            </div>
          </div>
        )}

        {addError && (
          <p className="mt-2 text-xs text-[hsl(var(--danger))]">{addError}</p>
        )}
        {addInfo && (
          <p className="mt-2 text-xs text-emerald-400">{addInfo}</p>
        )}
      </Card>

      {/* Pending list */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Pending{" "}
              <span className="font-num text-muted-foreground">
                ({loading ? "…" : pending.length})
              </span>
            </span>
            {processedCount > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {processedCount} processed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="h-7 w-36 pl-7 text-xs"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Pipeline is empty. Add a URL above to queue it for evaluation.
          </p>
        ) : filteredPending.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No results for &ldquo;{searchQ}&rdquo;
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredPending.map((e) => {
              const es = evalStates[e.url];
              return (
                <div key={e.url} className="p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {e.company && (
                        <span className="font-medium">{e.company}</span>
                      )}
                      {e.role && (
                        <span className="text-sm text-muted-foreground">
                          {e.company ? " · " : ""}
                          {e.role}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          "ml-2 px-1.5 py-0 text-[10px] " +
                          (e.hasJd ? "text-emerald-400" : "text-muted-foreground")
                        }
                        title={e.hasJd ? "Full JD captured — tailoring & evaluation use it" : "No JD stored — evaluation falls back to a title/company stub"}
                      >
                        {e.hasJd ? "JD ✓" : "no JD"}
                      </Badge>
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block truncate text-xs text-primary hover:underline"
                      >
                        {e.url}
                      </a>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={e.url} target="_blank" rel="noopener noreferrer" title="Open posting">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => evaluateEntry(e)}
                        disabled={es?.busy}
                        title="Evaluate & save report"
                      >
                        {es?.busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        )}
                        {es?.busy ? "Evaluating…" : "Evaluate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEntry(e.url)}
                        disabled={deletingUrl === e.url}
                        title="Remove from pipeline"
                      >
                        {deletingUrl === e.url ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {es?.result && (
                    <p className="mt-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">
                      {es.result}
                    </p>
                  )}
                  {es?.error && (
                    <p className="mt-1.5 text-xs text-[hsl(var(--danger))]">{es.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
