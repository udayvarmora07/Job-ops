"use client";

import { useState } from "react";
import { Linkedin, Copy, Check, Loader2, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notes {
  directAsk: string;
  warmIntro: string;
  referralFollowUp: string;
}

function CharCount({ text }: { text: string }) {
  const n = text.length;
  const over = n > 200;
  return (
    <span className={`font-num text-[10px] ${over ? "text-[hsl(var(--danger))]" : "text-muted-foreground"}`}>
      {n}/200{over ? " ⚠ over limit" : ""}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function NoteBox({ label, badge, text }: { label: string; badge?: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-foreground/80">{label}</span>
        {badge && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{badge}</Badge>}
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{text}</p>
      <div className="mt-1.5 flex items-center justify-between">
        {"directAsk warmIntro".includes(label.toLowerCase().replace(" ", "")) || label.toLowerCase().includes("note")
          ? <CharCount text={text} />
          : <span />}
        <CopyBtn text={text} />
      </div>
    </div>
  );
}

export function ConnectionNotes({
  company,
  role,
  persona,
  why,
}: {
  company: string;
  role?: string;
  persona?: string;
  why?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"direct" | "twostep">("direct");

  async function load() {
    if (notes) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals/connection-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, persona, why }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setNotes(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={load}
        disabled={loading}
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Linkedin className="h-3.5 w-3.5" />}
        {loading ? "Writing notes…" : "LinkedIn connection notes"}
        {!loading && notes && (open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </Button>

      {error && <p className="mt-1 text-xs text-[hsl(var(--danger))]">{error}</p>}

      {open && notes && (
        <div className="mt-2 space-y-2">
          {/* Mode switcher */}
          <div className="flex gap-1 rounded-md border border-border bg-background/30 p-0.5 w-fit">
            <button
              onClick={() => setMode("direct")}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "direct" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3 w-3" />
              Direct ask
            </button>
            <button
              onClick={() => setMode("twostep")}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "twostep" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Linkedin className="h-3 w-3" />
              Two-step
            </button>
          </div>

          {mode === "direct" && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">
                Send this as your connection note — includes a soft referral ask in one shot.
              </p>
              <NoteBox label="Connection note (direct ask)" badge="≤200 chars" text={notes.directAsk} />
            </div>
          )}

          {mode === "twostep" && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">
                Step 1 — send this as your connection note (no ask yet). Step 2 — once they accept, send the follow-up.
              </p>
              <NoteBox label="Step 1 — Connection note (intro only)" badge="≤200 chars" text={notes.warmIntro} />
              <NoteBox label="Step 2 — Follow-up DM (after they accept)" text={notes.referralFollowUp} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
