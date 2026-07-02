export interface Application {
  num: string;
  date: string;
  company: string;
  role: string;
  score: string;
  scoreNum: number | null;
  status: string;
  pdf: boolean;
  reportNum: string | null;
  notes: string;
}

export interface Job {
  url: string;
  company: string;
  role: string;
  portal: string | null;
  location: string | null;
  firstSeen: string | null;
  inPipeline: boolean;
  processed: boolean;
  source: "scan" | "pipeline" | "both";
  /** Compact display string derived from the title, e.g. "2-4 yr", "5+ yr". Null when unknown. */
  expRequired: string | null;
  /** Numeric lower bound in years for filtering. Null when unknown. */
  expMinYears: number | null;
}

export interface ReportMeta {
  id: string;
  file: string;
  title: string;
  company: string;
  role: string;
  date: string | null;
  score: string | null;
  scoreNum: number | null;
  url: string | null;
  legitimacy: string | null;
  archetype: string | null;
  location: string | null;
}

export type ReferralStatus =
  | "to_ask"
  | "asked"
  | "responded"
  | "referred"
  | "declined";

export interface Referral {
  id: string;
  company: string;
  role: string;
  contact: string;
  channel: string;
  status: ReferralStatus;
  jobUrl: string;
  note: string;
  askedDate: string | null;
  updatedAt: string;
}

/* Resume QA (mirror of lib-ai/tasks/resume-qa.mjs output). */
export type QaVerdict = "pass" | "minor_issues" | "needs_fixes" | "unknown";

export interface ResumeQaIssue {
  perspective: string;
  severity: "high" | "medium" | "low";
  issue: string;
  where: string;
  suggestion: string;
}

export interface AtsKeyword {
  term: string;
  weight: number; // 3 = required, 1 = preferred
}

export interface ResumeAtsScore {
  score: number | null; // null when the JD is too sparse to score by keywords
  basis: "keyword-match";
  reason?: string;
  coverage?: number;
  requiredHit?: number;
  requiredTotal?: number;
  matched?: AtsKeyword[];
  missing?: AtsKeyword[];
  penalties?: number;
  stuffed?: string[];
  keywordCount?: number;
}

export interface ResumeQa {
  verdict: QaVerdict;
  score: number | null; // authoritative ATS score (deterministic when ats.score is set)
  modelScore?: number | null; // the LLM's holistic score, kept for reference
  ats?: ResumeAtsScore; // deterministic keyword-match breakdown
  summary: string;
  perspectivesChecked: string[];
  issues: ResumeQaIssue[];
  checkedAt?: string;
}

/* Cold-outreach tracking (mirror of lib-outreach/store.mjs). */
export type OutreachStatus =
  | "drafted"
  | "sent"
  | "replied"
  | "bounced"
  | "no_response"
  | "closed";

export interface OutreachRecord {
  id: string;
  company: string;
  role: string;
  domain: string;
  contactName: string;
  contactTitle: string;
  persona: string;
  email: string;
  emailSource: string;
  verification: string;
  mode: "jd_specific" | "speculative";
  templateId: string;
  applyMethod: string;
  recruiterType: string;
  sourcePostUrl: string;
  subject: string;
  draftId: string;
  status: OutreachStatus;
  resumeFile: string;
  jobUrl: string;
  note: string;
  sentDate: string;
  followUpDate: string;
  createdAt: string;
  updatedAt: string;
}

/* Per-template A/B stats from GET /api/outreach (templateStats). */
export interface TemplateStat {
  templateId: string;
  name: string;
  drafted: number;
  sent: number;
  replied: number;
  bounced: number;
  no_response: number;
  closed: number;
  total: number;
  replyRate: number; // % of sent mails that got a reply
}

/* Parsed LinkedIn hiring post from POST /api/outreach/parse-post. */
export interface ParsedHiringPost {
  company: string;
  role: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite" | "";
  seniority: string;
  requirements: string[];
  mustHaves: string[];
  email: string;
  applyMethod: "email" | "form" | "dm" | "comment" | "unknown";
  contactName: string;
  contactTitle: string;
  recruiterType: "inhouse" | "agency" | "unknown";
  salary: string;
  confidence: number;
}

/* One ranked email candidate from POST /api/outreach/find-email. */
export interface EmailCandidate {
  email: string;
  sources: string[];
  baseScore: number;
  confidence: number;
  recommended: boolean;
  verification: {
    status: string;
    roleBased: boolean;
    catchAll: boolean;
    mx: boolean;
    providers: { provider: string; status: string }[];
  };
}

export interface FindEmailResult {
  name: string | null;
  domain: string | null;
  company: string | null;
  organization: string | null;
  pattern: string | null;
  acceptAll: boolean;
  steps: string[];
  candidates: EmailCandidate[];
  best: EmailCandidate | null;
}

/* One entry from POST /api/outreach/find-company-emails — extends EmailCandidate
   with name/title discovered from the indexed source. */
export interface CompanyEmailEntry extends EmailCandidate {
  name: string | null;
  title: string | null;
  type: string | null; // 'personal' | 'generic'
}

/* Response from POST /api/outreach/find-company-emails */
export interface CompanyEmailResult {
  company: string | null;
  domain: string | null;
  organization: string | null;
  pattern: string | null;
  acceptAll: boolean;
  steps: string[];
  totalIndexed: number;   // all emails Hunter knows at this domain
  totalHr: number;        // how many passed the HR/hiring filter
  candidates: CompanyEmailEntry[];
  quotaExceeded?: boolean;    // true when Hunter quota exhausted AND fallback found nothing
  linkedInFallback?: boolean; // true when results come from LinkedIn+SMTP rather than Hunter
}

/* Referral suggestions (mirror of lib/suggest.ts — kept here so client
   components can type the API response without importing server-only code). */
export type PersonaType = "peer" | "manager" | "recruiter" | "same_location";
export type AskType =
  | "referral_now"
  | "insight_first"
  | "is_hiring"
  | "recruiter_intro";
export type SuggestConfidence = "high" | "medium" | "low";

export interface DraftMessage {
  intent: "insight" | "referral";
  label: string;
  linkedin: string;
  emailSubject: string;
  emailBody: string;
}

export interface Suggestion {
  persona: PersonaType;
  personaLabel: string;
  titleQuery: string;
  score: number;
  scoreBreakdown: { label: string; value: number; weight: number }[];
  confidence: SuggestConfidence;
  recommendedAsk: AskType;
  recommendedAskLabel: string;
  reasons: string[];
  linkedinUrl: string;
  googleUrl: string;
  drafts: DraftMessage[];
}

export interface SuggestResult {
  company: string;
  role: string;
  pitchLine: string;
  roleMatch: number;
  locationMatch: boolean;
  suggestions: Suggestion[];
  buckets: {
    askNow: Suggestion[];
    buildFirst: Suggestion[];
    recruiterFallback: Suggestion[];
  };
}

/* AI referral targeting (mirror of lib-ai/tasks/referral-targets.mjs). */
export interface AiReferralTarget {
  rank: number;
  persona: string;
  who: string;
  why: string;
  warmth: "high" | "medium" | "low";
  linkedinKeywords: string;
  outreachMessage: string;
  linkedinUrl: string;
  googleUrl: string;
}

export interface AiReferralResult {
  company: string;
  role: string;
  strategy: string;
  targets: AiReferralTarget[];
  model: string;
}

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
  rates: { response: number; interview: number; offer: number };
  avgScore: number | null;
  byStatus: Record<string, number>;
  refByStatus: Record<string, number>;
}
