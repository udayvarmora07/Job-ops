"use client";

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  Link2,
  Briefcase,
  Target,
  Search,
  DollarSign,
  Check,
  Loader2,
  X,
  Plus,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ─────────────────────────────────────────────────────────────────

type Profile = {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  timezone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  employmentStatus?: string;
  availability?: string;
  visaStatus?: string;
  onsiteAvailability?: string;
  targetRoles?: string[];
  superpowers?: string[];
  pastCompanies?: string[];
  schools?: string[];
  targetCompanies?: string[];
  scanKeywords?: string[];
  compTargetRange?: string;
  compCurrency?: string;
  compMinimum?: string;
  compFlexibility?: string;
  essentialsComplete?: boolean;
  onboardingComplete?: boolean;
};

// ─── Nav sections ──────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "personal",     label: "Personal Info",     icon: User },
  { id: "links",        label: "Online Presence",   icon: Link2 },
  { id: "career",       label: "Career Status",     icon: Briefcase },
  { id: "targeting",    label: "Job Targeting",     icon: Target },
  { id: "search",       label: "Search Settings",   icon: Search },
  { id: "compensation", label: "Compensation",       icon: DollarSign },
] as const;

// ─── Progress calculation ───────────────────────────────────────────────────

function calcCompletion(p: Profile): number {
  const checks = [
    !!p.fullName?.trim(),
    !!p.email?.trim(),
    !!p.phone?.trim(),
    !!p.city?.trim() || !!p.country?.trim(),
    !!p.linkedinUrl?.trim(),
    !!p.githubUrl?.trim() || !!p.portfolioUrl?.trim(),
    !!p.employmentStatus,
    !!p.availability,
    (p.targetRoles?.length ?? 0) > 0,
    (p.superpowers?.length ?? 0) > 0,
    !!p.compTargetRange?.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── Avatar initials + colour ───────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-teal-600",
];

function getInitials(name?: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name?: string): string {
  if (!name?.trim()) return AVATAR_COLORS[0];
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ─── TagChipInput ───────────────────────────────────────────────────────────

interface TagChipInputProps {
  id: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}

function TagChipInput({ id, values, placeholder, onChange }: TagChipInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const tag = raw.trim();
    if (tag && !values.includes(tag)) {
      onChange([...values, tag]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(values.filter((v) => v !== tag));
  }

  return (
    <div
      className="flex min-h-[2.5rem] cursor-text flex-wrap gap-1.5 rounded-md border border-input bg-background/60 px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="ml-0.5 rounded-sm text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (draft.trim()) commit(draft); }}
        placeholder={values.length === 0 ? placeholder : "Add more…"}
        className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        aria-label={placeholder}
      />
    </div>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────────────

function Field({
  htmlFor,
  label,
  hint,
  children,
  required,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Section card ───────────────────────────────────────────────────────────

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 border-border/60 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <Separator className="mb-5 opacity-50" />
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

// ─── Skeleton loader ────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("personal");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile ?? {}))
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  // Highlight active nav section on scroll
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const completion = calcCompletion(profile);
  const initials = getInitials(profile.fullName);
  const avatarColor = getAvatarColor(profile.fullName);

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 px-2">
              <Link href="/">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            <span className="font-medium text-foreground">Profile & Settings</span>
          </div>

          <AnimatePresence mode="wait">
            {saved ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-sm text-emerald-500"
              >
                <Check className="h-4 w-4" />
                Saved
              </motion.span>
            ) : (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  type="submit"
                  form="profile-form"
                  size="sm"
                  disabled={saving}
                  className="h-8 gap-1.5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* ── Profile hero card ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card className="mb-8 overflow-hidden border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg ${avatarColor}`}
                  >
                    {loading ? (
                      <Skeleton className="h-20 w-20 rounded-2xl" />
                    ) : (
                      initials
                    )}
                  </div>
                  {profile.onboardingComplete && (
                    <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-md">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </span>
                  )}
                </div>

                {/* Name + info */}
                <div className="min-w-0 flex-1">
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-4 w-56" />
                    </div>
                  ) : (
                    <>
                      <h1 className="truncate text-xl font-semibold text-foreground">
                        {profile.fullName || "Your Profile"}
                      </h1>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {profile.email || "No email set"}
                        {profile.city && ` · ${profile.city}`}
                        {profile.country && `, ${profile.country}`}
                      </p>
                      {(profile.targetRoles?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {profile.targetRoles!.slice(0, 3).map((r) => (
                            <Badge key={r} variant="default" className="text-xs">
                              {r}
                            </Badge>
                          ))}
                          {(profile.targetRoles?.length ?? 0) > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{profile.targetRoles!.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Completion */}
                <div className="shrink-0 text-right">
                  <p className="mb-1 text-xs text-muted-foreground">Profile completion</p>
                  <div className="mb-1 text-right text-2xl font-bold tabular-nums text-foreground">
                    {loading ? <Skeleton className="ml-auto h-8 w-12" /> : `${completion}%`}
                  </div>
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full rounded-full ${
                        completion >= 80 ? "bg-emerald-500" : completion >= 50 ? "bg-amber-500" : "bg-primary"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${completion}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-start gap-3 overflow-hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4 opacity-70 hover:opacity-100" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-8">
          {/* ── Left sidebar nav (desktop) ── */}
          <aside className="hidden w-48 shrink-0 lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Sections
              </p>
              {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeSection === id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </a>
              ))}
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="min-w-0 flex-1">
            {loading ? (
              <ProfileSkeleton />
            ) : (
              <form id="profile-form" onSubmit={handleSave} className="space-y-6">

                {/* ─ Personal Info ─ */}
                <SectionCard
                  id="personal"
                  title="Personal Info"
                  description="Your basic identity details used across evaluations and CV generation."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field htmlFor="fullName" label="Full name" required>
                      <Input
                        id="fullName"
                        value={profile.fullName ?? ""}
                        onChange={(e) => set("fullName", e.target.value)}
                        placeholder="Jane Smith"
                        autoComplete="name"
                      />
                    </Field>
                    <Field
                      htmlFor="email"
                      label="Email"
                      hint="Managed by your account — read only."
                    >
                      <Input
                        id="email"
                        type="email"
                        value={profile.email ?? ""}
                        disabled
                        className="bg-muted/50 text-muted-foreground"
                        autoComplete="email"
                      />
                    </Field>
                    <Field htmlFor="phone" label="Phone">
                      <Input
                        id="phone"
                        type="tel"
                        value={profile.phone ?? ""}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="+1 555 000 0000"
                        autoComplete="tel"
                      />
                    </Field>
                    <Field htmlFor="timezone" label="Timezone">
                      <Select
                        id="timezone"
                        value={profile.timezone ?? ""}
                        onChange={(e) => set("timezone", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select timezone…</option>
                        <option value="UTC-8">Pacific Time (UTC−8)</option>
                        <option value="UTC-7">Mountain Time (UTC−7)</option>
                        <option value="UTC-6">Central Time (UTC−6)</option>
                        <option value="UTC-5">Eastern Time (UTC−5)</option>
                        <option value="UTC+0">UTC / London (UTC+0)</option>
                        <option value="UTC+1">Central European (UTC+1)</option>
                        <option value="UTC+2">Eastern European (UTC+2)</option>
                        <option value="UTC+3">Moscow / Riyadh (UTC+3)</option>
                        <option value="UTC+5:30">India (UTC+5:30)</option>
                        <option value="UTC+8">China / Singapore (UTC+8)</option>
                        <option value="UTC+9">Japan / Korea (UTC+9)</option>
                        <option value="UTC+10">Sydney (UTC+10)</option>
                      </Select>
                    </Field>
                    <Field htmlFor="city" label="City">
                      <Input
                        id="city"
                        value={profile.city ?? ""}
                        onChange={(e) => set("city", e.target.value)}
                        placeholder="San Francisco"
                        autoComplete="address-level2"
                      />
                    </Field>
                    <Field htmlFor="country" label="Country">
                      <Input
                        id="country"
                        value={profile.country ?? ""}
                        onChange={(e) => set("country", e.target.value)}
                        placeholder="United States"
                        autoComplete="country-name"
                      />
                    </Field>
                  </div>
                </SectionCard>

                {/* ─ Online Presence ─ */}
                <SectionCard
                  id="links"
                  title="Online Presence"
                  description="Links used in CV generation and referral outreach messages."
                >
                  <div className="space-y-4">
                    <Field htmlFor="linkedinUrl" label="LinkedIn URL">
                      <Input
                        id="linkedinUrl"
                        type="url"
                        value={profile.linkedinUrl ?? ""}
                        onChange={(e) => set("linkedinUrl", e.target.value)}
                        placeholder="https://linkedin.com/in/yourhandle"
                        autoComplete="url"
                      />
                    </Field>
                    <Field htmlFor="githubUrl" label="GitHub URL">
                      <Input
                        id="githubUrl"
                        type="url"
                        value={profile.githubUrl ?? ""}
                        onChange={(e) => set("githubUrl", e.target.value)}
                        placeholder="https://github.com/yourusername"
                      />
                    </Field>
                    <Field htmlFor="portfolioUrl" label="Portfolio / Website">
                      <Input
                        id="portfolioUrl"
                        type="url"
                        value={profile.portfolioUrl ?? ""}
                        onChange={(e) => set("portfolioUrl", e.target.value)}
                        placeholder="https://yoursite.com"
                      />
                    </Field>
                  </div>
                </SectionCard>

                {/* ─ Career Status ─ */}
                <SectionCard
                  id="career"
                  title="Career Status"
                  description="Informs AI evaluation context and helps filter relevant opportunities."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field htmlFor="employmentStatus" label="Employment status">
                      <Select
                        id="employmentStatus"
                        value={profile.employmentStatus ?? ""}
                        onChange={(e) => set("employmentStatus", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select status…</option>
                        <option value="employed">Currently employed</option>
                        <option value="unemployed">Unemployed / seeking</option>
                        <option value="freelance">Freelance / contract</option>
                        <option value="student">Student</option>
                        <option value="on-leave">On leave</option>
                      </Select>
                    </Field>
                    <Field htmlFor="availability" label="Availability">
                      <Select
                        id="availability"
                        value={profile.availability ?? ""}
                        onChange={(e) => set("availability", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select availability…</option>
                        <option value="immediate">Immediate</option>
                        <option value="1-week">1 week notice</option>
                        <option value="2-weeks">2 weeks notice</option>
                        <option value="1-month">1 month notice</option>
                        <option value="flexible">Flexible</option>
                      </Select>
                    </Field>
                    <Field htmlFor="visaStatus" label="Visa / work authorization">
                      <Select
                        id="visaStatus"
                        value={profile.visaStatus ?? ""}
                        onChange={(e) => set("visaStatus", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select status…</option>
                        <option value="citizen">Citizen</option>
                        <option value="permanent-resident">Permanent resident / PR</option>
                        <option value="h1b">H-1B</option>
                        <option value="tn">TN Visa</option>
                        <option value="opt">OPT / CPT</option>
                        <option value="work-permit">Work permit</option>
                        <option value="eu-citizen">EU citizen</option>
                        <option value="requires-sponsorship">Requires sponsorship</option>
                      </Select>
                    </Field>
                    <Field htmlFor="onsiteAvailability" label="Work location preference">
                      <Select
                        id="onsiteAvailability"
                        value={profile.onsiteAvailability ?? ""}
                        onChange={(e) => set("onsiteAvailability", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select preference…</option>
                        <option value="fully-remote">Fully remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="on-site">On-site</option>
                        <option value="flexible">Flexible / open</option>
                      </Select>
                    </Field>
                  </div>
                </SectionCard>

                {/* ─ Job Targeting ─ */}
                <SectionCard
                  id="targeting"
                  title="Job Targeting"
                  description="Used by the AI to evaluate fit and tailor your CV. Press Enter or comma to add a tag."
                >
                  <div className="space-y-5">
                    <Field
                      htmlFor="targetRoles"
                      label="Target roles"
                      hint="The job titles you are actively pursuing."
                      required
                    >
                      <TagChipInput
                        id="targetRoles"
                        values={profile.targetRoles ?? []}
                        placeholder="e.g. Senior Software Engineer"
                        onChange={(v) => set("targetRoles", v)}
                      />
                    </Field>
                    <Field
                      htmlFor="superpowers"
                      label="Superpowers / skills"
                      hint="Your strongest technical and soft skills — drives AI fit scoring."
                    >
                      <TagChipInput
                        id="superpowers"
                        values={profile.superpowers ?? []}
                        placeholder="e.g. React, TypeScript, System Design"
                        onChange={(v) => set("superpowers", v)}
                      />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field
                        htmlFor="pastCompanies"
                        label="Past companies"
                        hint="Where you have previously worked."
                      >
                        <TagChipInput
                          id="pastCompanies"
                          values={profile.pastCompanies ?? []}
                          placeholder="e.g. Google, Startup Inc"
                          onChange={(v) => set("pastCompanies", v)}
                        />
                      </Field>
                      <Field
                        htmlFor="schools"
                        label="Education"
                        hint="Universities and institutions attended."
                      >
                        <TagChipInput
                          id="schools"
                          values={profile.schools ?? []}
                          placeholder="e.g. MIT, Stanford"
                          onChange={(v) => set("schools", v)}
                        />
                      </Field>
                    </div>
                  </div>
                </SectionCard>

                {/* ─ Search Settings ─ */}
                <SectionCard
                  id="search"
                  title="Search Settings"
                  description="Configures the zero-cost job scanner. Keywords and companies that define what to look for."
                >
                  <div className="space-y-5">
                    <Field
                      htmlFor="scanKeywords"
                      label="Scan keywords"
                      hint="Job titles and terms the scanner watches for across portals."
                    >
                      <TagChipInput
                        id="scanKeywords"
                        values={profile.scanKeywords ?? []}
                        placeholder="e.g. Staff Engineer, Platform Lead"
                        onChange={(v) => set("scanKeywords", v)}
                      />
                    </Field>
                    <Field
                      htmlFor="targetCompanies"
                      label="Target companies"
                      hint="Companies you want to prioritise in scans and referral suggestions."
                    >
                      <TagChipInput
                        id="targetCompanies"
                        values={profile.targetCompanies ?? []}
                        placeholder="e.g. Stripe, Vercel, Linear"
                        onChange={(v) => set("targetCompanies", v)}
                      />
                    </Field>
                  </div>
                </SectionCard>

                {/* ─ Compensation ─ */}
                <SectionCard
                  id="compensation"
                  title="Compensation"
                  description="Drives the AI negotiation guidance and flags below-threshold offers."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field htmlFor="compTargetRange" label="Target range">
                      <Input
                        id="compTargetRange"
                        value={profile.compTargetRange ?? ""}
                        onChange={(e) => set("compTargetRange", e.target.value)}
                        placeholder="e.g. $130k–$160k"
                      />
                    </Field>
                    <Field htmlFor="compCurrency" label="Currency">
                      <Select
                        id="compCurrency"
                        value={profile.compCurrency ?? ""}
                        onChange={(e) => set("compCurrency", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select currency…</option>
                        <option value="USD">USD — US Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="GBP">GBP — British Pound</option>
                        <option value="CAD">CAD — Canadian Dollar</option>
                        <option value="AUD">AUD — Australian Dollar</option>
                        <option value="INR">INR — Indian Rupee</option>
                        <option value="SGD">SGD — Singapore Dollar</option>
                        <option value="CHF">CHF — Swiss Franc</option>
                        <option value="JPY">JPY — Japanese Yen</option>
                      </Select>
                    </Field>
                    <Field
                      htmlFor="compMinimum"
                      label="Minimum acceptable"
                      hint="Offers below this threshold are flagged as low-fit."
                    >
                      <Input
                        id="compMinimum"
                        value={profile.compMinimum ?? ""}
                        onChange={(e) => set("compMinimum", e.target.value)}
                        placeholder="e.g. $110k"
                      />
                    </Field>
                    <Field htmlFor="compFlexibility" label="Flexibility">
                      <Select
                        id="compFlexibility"
                        value={profile.compFlexibility ?? ""}
                        onChange={(e) => set("compFlexibility", e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select flexibility…</option>
                        <option value="firm">Firm — not negotiable</option>
                        <option value="flexible">Flexible — open to range</option>
                        <option value="negotiable">Negotiable — discuss all</option>
                        <option value="equity-priority">Equity priority</option>
                      </Select>
                    </Field>
                  </div>
                </SectionCard>

                {/* ─ Mobile save button ─ */}
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-5 py-4 lg:hidden">
                  <p className="text-sm text-muted-foreground">
                    Profile {completion}% complete
                  </p>
                  <Button type="submit" disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
