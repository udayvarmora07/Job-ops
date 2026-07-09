"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Linkedin,
  Search,
  Copy,
  Check,
  UserPlus,
  Target,
  MapPin,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectionNotes } from "./ConnectionNotes";
import type {
  Job,
  ReportMeta,
  Suggestion,
  SuggestResult,
  SuggestConfidence,
} from "@/lib/types";

type Variant = "success" | "warning" | "danger" | "primary" | "accent" | "outline";

function confidenceVariant(c: SuggestConfidence): Variant {
  return c === "high" ? "success" : c === "medium" ? "warning" : "outline";
}

function askVariant(ask: string): Variant {
  if (ask === "referral_now") return "success";
  if (ask === "recruiter_intro") return "accent";
  if (ask === "is_hiring") return "warning";
  return "primary";
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "hsl(var(--success))"
      : score >= 50
        ? "hsl(var(--warning))"
        : "hsl(var(--muted-foreground))";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="font-num text-xs text-muted-foreground">{score}</span>
    </div>
  );
}

function SuggestionCard({
  s,
  ctx,
  onTrack,
}: {
  s: Suggestion;
  ctx: { company: string; role: string; jobUrl?: string };
  onTrack: (s: Suggestion) => Promise<void>;
}) {
  const [intent, setIntent] = useState<"insight" | "referral">(
    s.recommendedAsk === "referral_now" ? "referral" : "insight"
  );
  const [tracked, setTracked] = useState(false);
  const [tracking, setTracking] = useState(false);
  const draft = s.drafts.find((d) => d.intent === intent) || s.drafts[0];

  return (
    <Card className="p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">{s.personaLabel}</Badge>
          <Badge variant={confidenceVariant(s.confidence)}>
            {s.confidence} confidence
          </Badge>
        </div>
        <ScoreBar score={s.score} />
      </div>

      <div className="mt-2">
        <Badge variant={askVariant(s.recommendedAsk)}>
          <Target className="h-3 w-3" />
          {s.recommendedAskLabel}
        </Badge>
      </div>

      <ul className="mt-2 space-y-0.5">
        {s.reasons.map((r, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            · {r}
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer">
            <Linkedin className="h-3.5 w-3.5" />
            LinkedIn search
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={s.googleUrl} target="_blank" rel="noopener noreferrer">
            <Search className="h-3.5 w-3.5" />
            Google X-ray
          </a>
        </Button>
        <Button
          variant={tracked ? "ghost" : "outline"}
          size="sm"
          disabled={tracking || tracked}
          onClick={async () => {
            setTracking(true);
            try {
              await onTrack(s);
              setTracked(true);
            } finally {
              setTracking(false);
            }
          }}
        >
          {tracked ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {tracked ? "Tracked" : "Track this"}
        </Button>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-card/40 p-2.5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          LinkedIn DM (after connecting)
        </p>
        <div className="mb-2 flex items-center gap-1.5">
          {s.drafts.map((d) => (
            <button
              key={d.intent}
              onClick={() => setIntent(d.intent)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                intent === d.intent
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
          {draft.linkedin}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton text={draft.linkedin} label="Copy DM" />
          <CopyButton
            text={`Subject: ${draft.emailSubject}\n\n${draft.emailBody}`}
            label="Copy email"
          />
        </div>
      </div>

      <ConnectionNotes
        company={ctx.company}
        role={ctx.role}
        persona={s.personaLabel}
      />
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function SuggestContacts({
  jobs,
  reports,
  onTracked,
}: {
  jobs: Job[];
  reports: ReportMeta[];
  onTracked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company: "", role: "", location: "", jobUrl: "" });
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick-pick options drawn from existing evaluated jobs + reports.
  const picks = useMemo(() => {
    const out: { key: string; label: string; company: string; role: string; location: string; jobUrl: string }[] = [];
    const seen = new Set<string>();
    for (const r of reports) {
      const k = `${r.company}|${r.role}`.toLowerCase();
      if (r.company && !seen.has(k)) {
        seen.add(k);
        out.push({
          key: `rep-${r.id}`,
          label: `${r.company} — ${r.role || "role"}`,
          company: r.company,
          role: r.role || "",
          location: r.location || "",
          jobUrl: r.url || "",
        });
      }
    }
    for (const j of jobs) {
      const k = `${j.company}|${j.role}`.toLowerCase();
      if (j.company && j.company !== "Unknown" && !seen.has(k)) {
        seen.add(k);
        out.push({
          key: `job-${j.url}`,
          label: `${j.company} — ${j.role || "role"}`,
          company: j.company,
          role: j.role || "",
          location: j.location || "",
          jobUrl: j.url || "",
        });
      }
    }
    return out.slice(0, 200);
  }, [jobs, reports]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyPick(key: string) {
    const p = picks.find((x) => x.key === key);
    if (p) setForm({ company: p.company, role: p.role, location: p.location, jobUrl: p.jobUrl });
  }

  async function run() {
    if (!form.company.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/referrals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResult(data.result || null);
    } finally {
      setLoading(false);
    }
  }

  async function track(s: Suggestion) {
    await fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: form.company,
        role: form.role,
        channel: "LinkedIn",
        jobUrl: form.jobUrl,
        status: "to_ask",
        note: `${s.personaLabel} · ${s.recommendedAskLabel}`,
      }),
    });
    onTracked();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="h-4 w-4" />
          Find people to ask
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] w-[min(92vw,720px)] max-w-none overflow-y-auto">
        <div className="border-b border-border px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Who to ask for a referral
          </DialogTitle>
        </div>

        <div className="space-y-3 p-5">
          {picks.length > 0 && (
            <Field label="Pick from your jobs / reports (optional)">
              <Select defaultValue="" onChange={(e) => applyPick(e.target.value)}>
                <option value="">— choose to autofill —</option>
                {picks.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Company *">
              <Input value={form.company} onChange={set("company")} placeholder="Acme Inc" />
            </Field>
            <Field label="Role">
              <Input value={form.role} onChange={set("role")} placeholder="Senior SRE" />
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={set("location")} placeholder="Bangalore / Remote" />
            </Field>
            <Field label="Job URL">
              <Input value={form.jobUrl} onChange={set("jobUrl")} placeholder="https://…" />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={run} disabled={loading || !form.company.trim()}>
              <Sparkles className="h-4 w-4" />
              {loading ? "Ranking…" : "Suggest contacts"}
            </Button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <Card className="p-3">
                  <CardContent className="p-0">
                    <p className="text-xs text-muted-foreground">
                      Your one-line pitch — what a referrer can repeat for you:
                    </p>
                    <p className="mt-1 text-sm font-medium">{result.pitchLine}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={result.roleMatch >= 0.66 ? "success" : "warning"}>
                        <Target className="h-3 w-3" />
                        Role fit {Math.round(result.roleMatch * 100)}%
                      </Badge>
                      {result.locationMatch && (
                        <Badge variant="accent">
                          <MapPin className="h-3 w-3" />
                          Location overlap
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {result.buckets.askNow.length > 0 && (
                  <Section title="Ask now" hint="Strong fit — a direct referral ask is reasonable.">
                    {result.buckets.askNow.map((s) => (
                      <SuggestionCard key={s.persona} s={s} ctx={form} onTrack={track} />
                    ))}
                  </Section>
                )}

                <Section
                  title="Build the relationship first"
                  hint="Open with a 10-min insight chat before any ask."
                >
                  {result.buckets.buildFirst.map((s) => (
                    <SuggestionCard key={s.persona} s={s} ctx={form} onTrack={track} />
                  ))}
                </Section>

                {result.buckets.recruiterFallback.length > 0 && (
                  <Section title="Recruiter fallback" hint="Good for routing and process clarity.">
                    {result.buckets.recruiterFallback.map((s) => (
                      <SuggestionCard key={s.persona} s={s} ctx={form} onTrack={track} />
                    ))}
                  </Section>
                )}

                <p className="pt-1 text-[11px] text-muted-foreground">
                  Personas + search links only — no scraping. Click through, find the
                  real person, edit the draft, then send. Don{"'"}t blast the whole company.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
