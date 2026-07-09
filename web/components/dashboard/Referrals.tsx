"use client";

import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { REFERRAL_LABELS, referralVariant } from "./status";
import { SuggestContacts } from "./SuggestContacts";
import { ConnectionNotes } from "./ConnectionNotes";
import type { Referral, ReferralStatus, Job, ReportMeta } from "@/lib/types";

const STATUSES: ReferralStatus[] = [
  "to_ask",
  "asked",
  "responded",
  "referred",
  "declined",
];

async function post(body: Record<string, unknown>) {
  await fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function AddReferral({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company: "",
    role: "",
    contact: "",
    channel: "LinkedIn",
    jobUrl: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.company.trim()) return;
    setSaving(true);
    try {
      await post({ ...form, status: "to_ask" });
      setForm({ company: "", role: "", contact: "", channel: "LinkedIn", jobUrl: "", note: "" });
      setOpen(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add referral
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <div className="border-b border-border px-5 py-3">
          <DialogTitle className="text-sm font-medium">
            Track a referral ask
          </DialogTitle>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Company *">
            <Input value={form.company} onChange={set("company")} placeholder="Acme Inc" />
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={set("role")} placeholder="Senior SRE" />
          </Field>
          <Field label="Contact">
            <Input value={form.contact} onChange={set("contact")} placeholder="Name of person to ask" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel">
              <Input value={form.channel} onChange={set("channel")} placeholder="LinkedIn" />
            </Field>
            <Field label="Job URL">
              <Input value={form.jobUrl} onChange={set("jobUrl")} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Note">
            <Input value={form.note} onChange={set("note")} placeholder="Context, mutual connection…" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={saving || !form.company.trim()}>
              {saving ? "Saving…" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

const ReferralCard = forwardRef<
  HTMLDivElement,
  {
    r: Referral;
    onChange: () => void;
  }
>(function ReferralCard({ r, onChange }, ref) {
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await post({ id: r.id, status });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/referrals?id=${encodeURIComponent(r.id)}`, {
        method: "DELETE",
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.company}</p>
            {r.role && (
              <p className="truncate text-xs text-muted-foreground">{r.role}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={busy}
            title="Delete"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-[hsl(var(--danger))]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {r.contact && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="text-foreground/80">{r.contact}</span> · {r.channel}
          </p>
        )}
        {r.note && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.note}</p>
        )}
        {r.askedDate && (
          <p className="font-num mt-1 text-[11px] text-muted-foreground">
            asked {r.askedDate}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          <Select
            value={r.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={busy}
            className="h-7 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {REFERRAL_LABELS[s]}
              </option>
            ))}
          </Select>
          {r.jobUrl && (
            <Button variant="ghost" size="icon" asChild className="h-7 w-7">
              <a href={r.jobUrl} target="_blank" rel="noopener noreferrer" title="Open job">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>

        {(r.status === "to_ask" || r.status === "asked") && (
          <ConnectionNotes
            company={r.company}
            role={r.role || ""}
            persona={r.contact || undefined}
          />
        )}
      </Card>
    </motion.div>
  );
});

export function Referrals({
  referrals,
  loading,
  onChange,
  jobs = [],
  reports = [],
}: {
  referrals: Referral[];
  loading: boolean;
  onChange: () => void;
  jobs?: Job[];
  reports?: ReportMeta[];
}) {
  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Track who you{"'"}ve asked for referrals and where each ask stands.
        </p>
        <div className="flex items-center gap-2">
          <SuggestContacts jobs={jobs} reports={reports} onTracked={onChange} />
          <AddReferral onAdded={onChange} />
        </div>
      </div>

      {referrals.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">No referrals tracked yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add one here, or hit the {"“"}Referral{"”"} button on any job in the
            Jobs tab to start tracking an ask.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STATUSES.map((status) => {
            const items = referrals.filter((r) => r.status === status);
            return (
              <div key={status} className="rounded-lg border border-border bg-card/40 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <Badge variant={referralVariant(status)}>
                    {REFERRAL_LABELS[status]}
                  </Badge>
                  <span className="font-num text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {items.map((r) => (
                      <ReferralCard key={r.id} r={r} onChange={onChange} />
                    ))}
                  </AnimatePresence>
                  {items.length === 0 && (
                    <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
                      —
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
