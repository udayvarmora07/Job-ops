"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Onboarding: a required "Essentials" step, then a single optional
 * "Additional details" screen (all remaining fields grouped into
 * collapsible sections instead of forced one-at-a-time steps).
 *
 * Resume/LinkedIn import pre-fills as much as possible; every field it
 * touches gets an "auto-filled" badge so the user knows to double-check it
 * (parsers get things wrong — silently trusting them is what erodes user
 * trust in this category, see competitor research).
 */

type Profile = {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  employmentStatus?: string;
  availability?: string;
  targetRoles?: string[];
  superpowers?: string[];
  pastCompanies?: string[];
  schools?: string[];
  compTargetRange?: string;
  compCurrency?: string;
  compMinimum?: string;
  compFlexibility?: string;
  scanKeywords?: string[];
  targetCompanies?: string[];
  essentialsComplete?: boolean;
  onboardingComplete?: boolean;
};

const STEPS = ["Essentials", "Additional details"] as const;

const IMPORT_STAGES = ["Reading your file…", "Extracting your experience…", "Almost done…"];

/** Raw parser/library errors ("Object.defineProperty called on non-object",
 * stack traces, etc.) are meaningless to a job seeker and erode trust.
 * Swap anything that looks technical for an actionable message; keep
 * genuinely useful validation messages (e.g. "text too short") as-is. */
function friendlyImportError(raw: string): string {
  const looksTechnical =
    /Object\.|TypeError|ReferenceError|at \w+ \(|node_modules|undefined is not|Cannot read prop|ENOENT|is not a function/i.test(
      raw,
    );
  if (!looksTechnical) return raw;
  return "We couldn't read that automatically. Try pasting the text instead, or fill in the form below.";
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local input buffers for array fields (comma-separated → split on save)
  const [roleInput, setRoleInput] = useState("");
  const [superpowerInput, setSuperpowerInput] = useState("");
  const [pastCompanyInput, setPastCompanyInput] = useState("");
  const [schoolInput, setSchoolInput] = useState("");
  const [scanKeywordInput, setScanKeywordInput] = useState("");
  const [targetCompanyInput, setTargetCompanyInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStage, setImportStage] = useState(0);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // Fields the last import touched — rendered with an "auto-filled" badge
  // until the user edits them by hand.
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const importTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing profile (if any) so a returning user doesn't lose data.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/profile", { headers });
        if (res.ok) {
          const data = await res.json();
          const p = data.profile as Profile;
          setProfile(p);
          setRoleInput((p.targetRoles || []).join(", "));
          setSuperpowerInput((p.superpowers || []).join(", "));
          setPastCompanyInput((p.pastCompanies || []).join(", "));
          setSchoolInput((p.schools || []).join(", "));
          setScanKeywordInput((p.scanKeywords || []).join(", "));
          setTargetCompanyInput((p.targetCompanies || []).join(", "));
        }
      } catch {
        /* ignore — fresh user */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (importTimer.current) clearInterval(importTimer.current);
    };
  }, []);

  const beginImport = () => {
    setImporting(true);
    setImportStage(0);
    setError(null);
    if (importTimer.current) clearInterval(importTimer.current);
    importTimer.current = setInterval(() => {
      setImportStage((s) => Math.min(s + 1, IMPORT_STAGES.length - 1));
    }, 1400);
  };

  const endImport = () => {
    setImporting(false);
    if (importTimer.current) clearInterval(importTimer.current);
  };

  const save = useCallback(
    async (patch: Partial<Profile>, opts?: { final?: boolean }) => {
      setSaving(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const body: Record<string, unknown> = { ...patch };
        if (opts?.final) body.onboardingComplete = true;

        const res = await fetch("/api/profile", {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Save failed (${res.status})`);
        }
        const data = await res.json();
        setProfile(data.profile as Profile);
        return data.profile as Profile;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const parseList = (input: string): string[] =>
    input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  /** Merge parsed fields into the form (only fills blanks) and mark which
   * ones changed so they get the "auto-filled" badge. */
  function applyParsed(p: Partial<Profile>) {
    const touched: string[] = [];
    setProfile((prev) => {
      const next = { ...prev };
      if (p.fullName && !prev.fullName) (next.fullName = p.fullName), touched.push("fullName");
      if (p.city && !prev.city) (next.city = p.city), touched.push("city");
      if (p.country && !prev.country) (next.country = p.country), touched.push("country");
      if (p.linkedinUrl && !prev.linkedinUrl) (next.linkedinUrl = p.linkedinUrl), touched.push("linkedinUrl");
      if (p.githubUrl && !prev.githubUrl) (next.githubUrl = p.githubUrl), touched.push("githubUrl");
      if (p.portfolioUrl && !prev.portfolioUrl) (next.portfolioUrl = p.portfolioUrl), touched.push("portfolioUrl");
      if (p.phone && !prev.phone) (next.phone = p.phone), touched.push("phone");
      return next;
    });
    if (p.targetRoles?.length && !roleInput.trim()) {
      setRoleInput(p.targetRoles.join(", "));
      touched.push("targetRoles");
    }
    if (p.superpowers?.length && !superpowerInput.trim()) {
      setSuperpowerInput(p.superpowers.join(", "));
      touched.push("superpowers");
    }
    if (p.pastCompanies?.length && !pastCompanyInput.trim()) {
      setPastCompanyInput(p.pastCompanies.join(", "));
      touched.push("pastCompanies");
    }
    if (p.schools?.length && !schoolInput.trim()) {
      setSchoolInput(p.schools.join(", "));
      touched.push("schools");
    }
    if (touched.length) setAutoFilled((prev) => new Set(Array.from(prev).concat(touched)));
  }

  /** Clear the auto-filled badge for a field the user edits by hand. */
  const untouch = (field: string) =>
    setAutoFilled((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });

  // --- Resume upload + AI parse ---
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    beginImport();
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/parse-resume", {
        method: "POST",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Parse failed (${res.status})`);
      }
      const data = await res.json();
      applyParsed(data.parsed as Partial<Profile>);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(friendlyImportError(raw));
      setShowPaste(true);
    } finally {
      endImport();
      e.target.value = "";
    }
  };

  // --- Paste-text fallback (works for scanned PDFs, DOCX, anything the
  // file parser chokes on — the API already accepts raw text). ---
  const handlePasteParse = async () => {
    if (!pasteText.trim()) return;
    beginImport();
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/profile/parse-resume", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: pasteText }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Parse failed (${res.status})`);
      }
      const data = await res.json();
      applyParsed(data.parsed as Partial<Profile>);
      setShowPaste(false);
      setPasteText("");
    } catch (err) {
      setError(friendlyImportError(err instanceof Error ? err.message : String(err)));
    } finally {
      endImport();
    }
  };

  // --- LinkedIn import ---
  const handleLinkedInImport = async () => {
    if (!linkedinUrl.trim()) return;
    beginImport();
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/profile/import-linkedin", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: linkedinUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Import failed (${res.status})`);
      }
      const data = await res.json();
      applyParsed(data.parsed as Partial<Profile>);
      setProfile((prev) => ({ ...prev, linkedinUrl }));
    } catch (err) {
      setError(friendlyImportError(err instanceof Error ? err.message : String(err)));
      setShowPaste(true);
    } finally {
      endImport();
    }
  };

  // --- Step 0: Essentials ---
  const saveEssentials = async () => {
    const patch: Partial<Profile> = {
      fullName: profile.fullName,
      city: profile.city,
      country: profile.country,
      targetRoles: parseList(roleInput),
    };
    const saved = await save(patch);
    if (saved?.essentialsComplete) {
      setStep(1);
    }
  };

  // --- Finalize: mark onboarding complete ---
  const finishOnboarding = async () => {
    const patch: Partial<Profile> = {
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      phone: profile.phone,
      employmentStatus: profile.employmentStatus,
      availability: profile.availability,
      superpowers: parseList(superpowerInput),
      pastCompanies: parseList(pastCompanyInput),
      schools: parseList(schoolInput),
      scanKeywords: parseList(scanKeywordInput),
      targetCompanies: parseList(targetCompanyInput),
      compTargetRange: profile.compTargetRange,
      compCurrency: profile.compCurrency,
      compMinimum: profile.compMinimum,
      compFlexibility: profile.compFlexibility,
    };
    await save(patch, { final: true });
    router.push("/");
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg space-y-4">
        <p className="text-center text-muted-foreground">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Jobops</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 0: Essentials (required) */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Quick import options */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Quick start (optional)</p>
            <p className="text-xs text-muted-foreground">
              Upload a resume or import from LinkedIn to pre-fill the form below.
            </p>
            <div className="flex flex-wrap gap-2">
              <label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleResumeUpload}
                  disabled={importing}
                />
                <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
                  {importing ? IMPORT_STAGES[importStage] : "📄 Upload resume"}
                </span>
              </label>
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => setShowPaste((s) => !s)}
                disabled={importing}
              >
                {showPaste ? "Hide paste box" : "Or paste resume text"}
              </button>
            </div>

            {showPaste && (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-xs"
                  placeholder="Paste your resume text here — useful if the PDF/DOCX upload can't be read (scanned images, unusual formatting)."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={importing}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePasteParse}
                  disabled={importing || !pasteText.trim()}
                >
                  {importing ? IMPORT_STAGES[importStage] : "Parse text"}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="https://linkedin.com/in/your-profile"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                disabled={importing}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLinkedInImport}
                disabled={importing || !linkedinUrl.trim()}
              >
                {importing ? "…" : "Import"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel required autoFilled={autoFilled.has("fullName")}>
              Full name
            </FieldLabel>
            <Input
              placeholder="Jane Doe"
              value={profile.fullName || ""}
              onChange={(e) => {
                untouch("fullName");
                setProfile((p) => ({ ...p, fullName: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel required autoFilled={autoFilled.has("targetRoles")}>
              Target roles <span className="text-muted-foreground">(comma-separated)</span>
            </FieldLabel>
            <Input
              placeholder="DevOps Engineer, SRE, Platform Engineer"
              value={roleInput}
              onChange={(e) => {
                untouch("targetRoles");
                setRoleInput(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required autoFilled={autoFilled.has("city")}>
                City
              </FieldLabel>
              <Input
                placeholder="Berlin"
                value={profile.city || ""}
                onChange={(e) => {
                  untouch("city");
                  setProfile((p) => ({ ...p, city: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel required autoFilled={autoFilled.has("country")}>
                Country
              </FieldLabel>
              <Input
                placeholder="Germany"
                value={profile.country || ""}
                onChange={(e) => {
                  untouch("country");
                  setProfile((p) => ({ ...p, country: e.target.value }));
                }}
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={saveEssentials}
            disabled={saving || !profile.fullName?.trim() || !roleInput.trim() || (!profile.city?.trim() && !profile.country?.trim())}
          >
            {saving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      )}

      {/* Step 1: Everything else — optional, single scrollable screen */}
      {step === 1 && (
        <div className="space-y-5">
          <Section title="Links">
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("linkedinUrl")}>LinkedIn URL</FieldLabel>
              <Input
                placeholder="https://linkedin.com/in/janedoe"
                value={profile.linkedinUrl || ""}
                onChange={(e) => {
                  untouch("linkedinUrl");
                  setProfile((p) => ({ ...p, linkedinUrl: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("githubUrl")}>GitHub URL</FieldLabel>
              <Input
                placeholder="https://github.com/janedoe"
                value={profile.githubUrl || ""}
                onChange={(e) => {
                  untouch("githubUrl");
                  setProfile((p) => ({ ...p, githubUrl: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("portfolioUrl")}>Portfolio URL</FieldLabel>
              <Input
                placeholder="https://janedoe.dev"
                value={profile.portfolioUrl || ""}
                onChange={(e) => {
                  untouch("portfolioUrl");
                  setProfile((p) => ({ ...p, portfolioUrl: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("phone")}>Phone</FieldLabel>
              <Input
                placeholder="+49 30 12345678"
                value={profile.phone || ""}
                onChange={(e) => {
                  untouch("phone");
                  setProfile((p) => ({ ...p, phone: e.target.value }));
                }}
              />
            </div>
          </Section>

          <Section title="Status">
            <div className="space-y-2">
              <FieldLabel>Employment status</FieldLabel>
              <Input
                placeholder="actively-looking, passive, employed"
                value={profile.employmentStatus || ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, employmentStatus: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Availability</FieldLabel>
              <Input
                placeholder="Immediately, 2 weeks notice"
                value={profile.availability || ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, availability: e.target.value }))
                }
              />
            </div>
          </Section>

          <Section title="Targeting">
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("superpowers")}>
                Superpowers <span className="text-muted-foreground">(comma-separated)</span>
              </FieldLabel>
              <Input
                placeholder="Kubernetes, Terraform, CI/CD, AWS"
                value={superpowerInput}
                onChange={(e) => {
                  untouch("superpowers");
                  setSuperpowerInput(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("pastCompanies")}>
                Past companies <span className="text-muted-foreground">(for referral matching)</span>
              </FieldLabel>
              <Input
                placeholder="Google, Stripe, Shopify"
                value={pastCompanyInput}
                onChange={(e) => {
                  untouch("pastCompanies");
                  setPastCompanyInput(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel autoFilled={autoFilled.has("schools")}>
                Schools <span className="text-muted-foreground">(for alumni matching)</span>
              </FieldLabel>
              <Input
                placeholder="MIT, TU Berlin"
                value={schoolInput}
                onChange={(e) => {
                  untouch("schools");
                  setSchoolInput(e.target.value);
                }}
              />
            </div>
          </Section>

          <Section title="Comp & scan">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel>Comp target range</FieldLabel>
                <Input
                  placeholder="$120k-$140k"
                  value={profile.compTargetRange || ""}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, compTargetRange: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Currency</FieldLabel>
                <Input
                  placeholder="USD, EUR, INR"
                  value={profile.compCurrency || ""}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, compCurrency: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel>Comp minimum</FieldLabel>
                <Input
                  placeholder="$110k"
                  value={profile.compMinimum || ""}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, compMinimum: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Comp flexibility</FieldLabel>
                <Input
                  placeholder="firm, slight-flex, flexible"
                  value={profile.compFlexibility || ""}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, compFlexibility: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>
                Scan keywords <span className="text-muted-foreground">(comma-separated)</span>
              </FieldLabel>
              <Input
                placeholder="DevOps, SRE, Platform Engineer"
                value={scanKeywordInput}
                onChange={(e) => setScanKeywordInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>
                Target companies <span className="text-muted-foreground">(comma-separated)</span>
              </FieldLabel>
              <Input
                placeholder="Vercel, Datadog, HashiCorp"
                value={targetCompanyInput}
                onChange={(e) => setTargetCompanyInput(e.target.value)}
              />
            </div>
          </Section>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button className="flex-1" onClick={finishOnboarding} disabled={saving}>
              {saving ? "Saving…" : "Finish"}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <button
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/")}
        >
          Skip for now →
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Field label with a required marker and/or an "auto-filled" badge —
 * surfacing which fields came from AI parsing so the user knows to
 * double-check them, rather than silently trusting the parser. */
function FieldLabel({
  children,
  required,
  autoFilled,
}: {
  children: React.ReactNode;
  required?: boolean;
  autoFilled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium">
      <span>
        {children}
        {required && " *"}
      </span>
      {autoFilled && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">
          auto-filled — check this
        </span>
      )}
    </label>
  );
}
