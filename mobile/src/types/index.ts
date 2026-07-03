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
  funnel: Array<{ label: string; count: number; pct: number }>;
  avgScore?: number | null;
  byStatus?: Record<string, number>;
}

/** Pipeline inbox item from GET /api/pipeline. */
export interface PipelineItem {
  url: string;
  status: string;
  title: string | null;
  company: string | null;
  notes: string | null;
}

/** Evaluation report from GET /api/reports. */
export interface Report {
  num: number;
  company: string;
  role: string;
  score: number | null;
  status: string;
  pdfUrl: string | null;
}
