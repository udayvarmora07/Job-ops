/**
 * Shared data models — mirror the Career-Ops / Jobops backend API responses.
 * Keep in sync with web/app/api/* route shapes and prisma/schema.prisma.
 */

/** Canonical application states — source of truth: templates/states.yml */
export type ApplicationStatus =
  | "Evaluated"
  | "Applied"
  | "Responded"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Discarded"
  | "SKIP";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Evaluated",
  "Applied",
  "Responded",
  "Interview",
  "Offer",
  "Rejected",
  "Discarded",
  "SKIP",
];

/** Job from GET /api/jobs — one scanned/pipeline posting. */
export interface Job {
  url: string;
  company: string;
  role: string;
  portal: string;
  location: string | null;
  firstSeen: string; // YYYY-MM-DD
  inPipeline: boolean;
  processed: boolean;
  source: "scan" | "both";
  expRequired: string | null;
  expMinYears: number | null;
}

/** Application row from GET /api/applications. */
export interface Application {
  num: string; // zero-padded, e.g. "007"
  date: string; // YYYY-MM-DD
  company: string;
  role: string;
  score: string; // e.g. "4.2/5" or "—"
  scoreNum: number | null;
  status: ApplicationStatus | string;
  pdf: boolean;
  reportNum: string | null;
  notes: string;
}

/** Dashboard summary from GET /api/summary. */
export interface Summary {
  counts: {
    fetchedJobs: number;
    inPipeline: number;
    processed: number;
    evaluated: number;
    reports: number;
    referrals: number;
  };
  funnel: { label: string; count: number; pct: number }[];
  rates?: { response: number; interview: number; offer: number };
  avgScore?: number | null;
  byStatus?: Record<string, number>;
}

/** Pipeline inbox item from GET /api/pipeline (`pending` array). */
export interface PipelineItem {
  url: string;
  company: string | null;
  role: string | null;
  hasJd: boolean;
}

/** Evaluation report metadata from GET /api/reports. */
export interface Report {
  id: string; // zero-padded, e.g. "001"
  file: string;
  title: string;
  company: string;
  role: string;
  date: string; // YYYY-MM-DD
  score: string; // "4.3/5" or "—"
  scoreNum: number | null;
  url: string | null;
  legitimacy: string | null;
  archetype: string | null;
  location: string | null;
}

/** Referral from GET /api/referrals. */
export interface Referral {
  id: string;
  company: string;
  role: string;
  contact: string;
  channel: string;
  status: string;
  jobUrl: string;
  note: string;
  askedDate: string | null;
  updatedAt: string;
}

/** Outreach record from GET /api/outreach. */
export interface Outreach {
  id: string;
  company: string;
  role: string;
  domain: string;
  contactName: string;
  contactTitle: string;
  email: string;
  verification: string;
  subject: string;
  status: string;
  sentDate: string | null;
  followUpDate: string | null;
  note: string;
}

/** Result of POST /api/evaluate-save. */
export interface EvaluateResult {
  ok: boolean;
  num: string;
  company: string;
  role: string;
  score: string;
  reportId: number | string;
  report: string;
}

/** Result of a portal scan (parsed from the SSE stream). */
export interface ScanResult {
  summary: string;
  ok: boolean;
  sources: { id: string; label?: string; new: number | null }[];
}

/** ATS / QA review of a résumé (POST /api/resume-qa). */
export interface ResumeQa {
  verdict?: string;
  score?: number | null;
  modelScore?: number | null;
  summary?: string;
  issues?: { title?: string; detail?: string; severity?: string }[];
  ats?: {
    score?: number | null;
    requiredHit?: number;
    requiredTotal?: number;
    matched?: string[];
    missing?: string[];
    penalties?: number;
  };
}

/** Result of POST /api/generate-cv-pdf (saved server-side). */
export interface GenerateCvResult {
  savedFilename: string | null;
  savedVersion: string | null;
}

/** The user's editable career profile (GET/PUT /api/profile). */
export interface UserProfile {
  userId?: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;

  employmentStatus?: string | null;
  availability?: string | null;
  visaStatus?: string | null;
  onsiteAvailability?: string | null;

  targetRoles?: string[];
  superpowers?: string[];

  compTargetRange?: string | null;
  compCurrency?: string | null;
  compMinimum?: string | null;
  compFlexibility?: string | null;

  pastCompanies?: string[];
  schools?: string[];

  cvMarkdown?: string | null;

  essentialsComplete?: boolean;
  onboardingComplete?: boolean;
}

/** One discovered hiring post (POST /api/outreach/scan-posts). */
export interface ScannedPost {
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

/** Structured hiring post (POST /api/outreach/parse-post → parsed). */
export interface ParsedHiringPost {
  company?: string;
  role?: string;
  email?: string;
  applyMethod?: string;
  requirements?: string[];
  location?: string;
  [key: string]: unknown;
}

/** Cold email drafted from a hiring post (POST /api/outreach/from-post). */
export interface FromPostResult {
  subject: string;
  body: string;
  templateName?: string;
  model?: string;
  error?: string;
}

/** One discovered company email (POST /api/outreach/find-company-emails). */
export interface CompanyEmail {
  email: string;
  name?: string;
  title?: string;
  confidence?: number;
}

/** Result of find-company-emails — kept loose (finder shapes vary). */
export interface CompanyEmailResult {
  domain?: string;
  emails?: CompanyEmail[];
  [key: string]: unknown;
}

/** Structured fields returned by resume/LinkedIn parsing (best-effort prefill). */
export interface ParsedProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  city?: string;
  country?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  targetRoles?: string[];
  skills?: string[];
  summary?: string;
  [key: string]: unknown;
}

/** One rule-based referral persona suggestion (POST /api/referrals/suggest). */
export interface ReferralSuggestion {
  persona: string;
  personaLabel: string;
  score: number;
  confidence: string;
  recommendedAsk: string;
  recommendedAskLabel: string;
  reasons: string[];
  linkedinUrl: string;
  titleQuery?: string;
}

export interface SuggestResult {
  company: string;
  role: string;
  pitchLine: string;
  suggestions: ReferralSuggestion[];
}

/** One AI-generated referral target persona (POST /api/referrals/ai-targets). */
export interface AiTarget {
  rank?: number;
  persona?: string;
  who?: string;
  why?: string;
  warmth?: string;
  outreachMessage?: string;
  linkedinUrl?: string;
  googleUrl?: string;
  [k: string]: unknown;
}

export interface AiTargetsResult {
  cached: boolean;
  company: string;
  role: string;
  strategy: string;
  targets: AiTarget[];
}

/** Two LinkedIn connection notes + a follow-up (POST /api/referrals/connection-notes). */
export interface ConnectionNotesResult {
  ok?: boolean;
  directAsk?: string;
  warmIntro?: string;
  referralFollowUp?: string;
}

/** A real person from the LinkedIn scraper (POST /api/referrals/find-people). */
export interface FoundPerson {
  name?: string;
  headline?: string;
  linkedinUrl?: string;
  profileUrl?: string;
  location?: string;
  [k: string]: unknown;
}

export interface FindPeopleResult {
  cached: boolean;
  people: FoundPerson[];
}

/** Composed outreach email (POST /api/outreach/compose). */
export interface ComposeResult {
  subject: string;
  body: string;
  templateId?: string;
  templateName?: string;
  model?: string;
}

/** Email-finder result (POST /api/outreach/find-email). */
export interface FindEmailResult {
  email?: string;
  verification?: string;
  source?: string;
  [k: string]: unknown;
}

/** One PDF version within a resume group. */
export interface ResumeFile {
  name: string;
  version: number;
  url: string;
  mtime: string;
  company?: string | null;
  role?: string | null;
}

/** Resume group (all versions of one tailored resume) from GET /api/resumes. */
export interface ResumeGroup {
  suffix: string;
  displayName: string;
  files: ResumeFile[];
  latestMtime: string;
  company: string | null;
  role: string | null;
}

/** Notification preferences (local settings). */
export interface NotificationPrefs {
  newMatches: boolean;
  applicationUpdates: boolean;
  interviewReminders: boolean;
}
