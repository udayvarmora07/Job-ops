import type {
  Application,
  Job,
  Outreach,
  PipelineItem,
  Referral,
  Report,
  ResumeGroup,
  Summary,
} from "@/types";

/**
 * Bundled sample data used when the backend is unreachable (e.g. running in
 * Expo Go on a phone with no dev server on localhost:3000). Lets the app stay
 * fully explorable offline. A "Demo data" banner is shown whenever this is used.
 */
export const demoSummary: Summary = {
  counts: { fetchedJobs: 128, inPipeline: 9, processed: 34, evaluated: 21, reports: 21, referrals: 4 },
  funnel: [
    { label: "Evaluated", count: 21, pct: 100 },
    { label: "Applied", count: 12, pct: 57 },
    { label: "Interview", count: 4, pct: 19 },
    { label: "Offer", count: 1, pct: 5 },
  ],
};

export const demoJobs: Job[] = [
  { url: "https://boards.greenhouse.io/google/jobs/123", company: "Google", role: "Senior Site Reliability Engineer", portal: "greenhouse", location: "Remote", firstSeen: "2026-06-30", inPipeline: true, processed: true, source: "both", expRequired: null, expMinYears: null },
  { url: "https://jobs.lever.co/netflix/456", company: "Netflix", role: "DevOps Engineer", portal: "lever", location: "Los Angeles", firstSeen: "2026-07-01", inPipeline: false, processed: false, source: "scan", expRequired: null, expMinYears: null },
  { url: "https://jobs.ashbyhq.com/stripe/789", company: "Stripe", role: "Platform Engineer", portal: "ashby", location: "Remote (US)", firstSeen: "2026-07-02", inPipeline: true, processed: false, source: "both", expRequired: null, expMinYears: null },
  { url: "https://boards.greenhouse.io/datadog/000", company: "Datadog", role: "Cloud SRE", portal: "greenhouse", location: "Hybrid NYC", firstSeen: "2026-07-02", inPipeline: false, processed: false, source: "scan", expRequired: null, expMinYears: null },
];

export const demoApplications: Application[] = [
  { num: "021", date: "2026-06-28", company: "Google", role: "Senior SRE", score: "4.5/5", scoreNum: 4.5, status: "Interview", pdf: true, reportNum: "021", notes: "Onsite scheduled" },
  { num: "020", date: "2026-06-25", company: "Netflix", role: "DevOps Engineer", score: "4.2/5", scoreNum: 4.2, status: "Applied", pdf: true, reportNum: "020", notes: "" },
  { num: "019", date: "2026-06-22", company: "Stripe", role: "Platform Engineer", score: "4.0/5", scoreNum: 4.0, status: "Offer", pdf: true, reportNum: "019", notes: "Verbal offer" },
  { num: "018", date: "2026-06-20", company: "Amazon", role: "Systems Engineer", score: "3.4/5", scoreNum: 3.4, status: "Rejected", pdf: false, reportNum: "018", notes: "Below bar on comp" },
];

export const demoReports: Report[] = [
  { id: "021", file: "021-google-2026-06-28.md", title: "Google — Senior SRE", company: "Google", role: "Senior SRE", date: "2026-06-28", score: "4.5/5", scoreNum: 4.5, url: null, legitimacy: "Verified", archetype: "Reliability", location: "Remote" },
  { id: "020", file: "020-netflix-2026-06-25.md", title: "Netflix — DevOps Engineer", company: "Netflix", role: "DevOps Engineer", date: "2026-06-25", score: "4.2/5", scoreNum: 4.2, url: null, legitimacy: "Verified", archetype: "Platform", location: "Los Angeles" },
  { id: "019", file: "019-stripe-2026-06-22.md", title: "Stripe — Platform Engineer", company: "Stripe", role: "Platform Engineer", date: "2026-06-22", score: "4.0/5", scoreNum: 4.0, url: null, legitimacy: "Likely", archetype: "Platform", location: "Remote" },
];

export const demoPipeline: PipelineItem[] = [
  { url: "https://boards.greenhouse.io/stripe/jobs/555", company: "Stripe", role: "Platform Engineer", hasJd: true },
  { url: "https://jobs.lever.co/datadog/777", company: "Datadog", role: "Cloud SRE", hasJd: false },
];

export const demoReferrals: Referral[] = [
  { id: "1", company: "Stripe", role: "Platform Engineer", contact: "Alex Rivera", channel: "LinkedIn", status: "responded", jobUrl: "", note: "Warm intro via ex-colleague", askedDate: "2026-06-20", updatedAt: "2026-06-22T10:00:00.000Z" },
  { id: "2", company: "Google", role: "Senior SRE", contact: "Priya Nair", channel: "Email", status: "pending", jobUrl: "", note: "", askedDate: null, updatedAt: "2026-06-25T10:00:00.000Z" },
];

export const demoOutreach: Outreach[] = [
  { id: "o1", company: "Netflix", role: "DevOps Engineer", domain: "netflix.com", contactName: "Jordan Lee", contactTitle: "Eng Manager", email: "jordan@netflix.com", verification: "valid", subject: "DevOps — 80% faster releases", status: "sent", sentDate: "2026-06-24", followUpDate: "2026-06-30", note: "" },
  { id: "o2", company: "Datadog", role: "Cloud SRE", domain: "datadoghq.com", contactName: "Sam Cole", contactTitle: "Recruiter", email: "sam@datadoghq.com", verification: "catch-all", subject: "Cloud SRE — reliability wins", status: "draft", sentDate: null, followUpDate: null, note: "" },
];

export const demoResumes: ResumeGroup[] = [
  { suffix: "Google_SRE", displayName: "Google SRE", latestMtime: "2026-06-28T10:00:00.000Z", company: "Google", role: "Senior SRE", files: [
    { name: "Uday_Varmora_Google_SRE_Resume_v2.pdf", version: 2, url: "/api/resumes/Uday_Varmora_Google_SRE_Resume_v2.pdf", mtime: "2026-06-28T10:00:00.000Z", company: "Google", role: "Senior SRE" },
    { name: "Uday_Varmora_Google_SRE_Resume.pdf", version: 1, url: "/api/resumes/Uday_Varmora_Google_SRE_Resume.pdf", mtime: "2026-06-27T10:00:00.000Z", company: "Google", role: "Senior SRE" },
  ] },
  { suffix: "Netflix_DevOps", displayName: "Netflix DevOps", latestMtime: "2026-06-25T10:00:00.000Z", company: "Netflix", role: "DevOps Engineer", files: [
    { name: "Uday_Varmora_Netflix_DevOps_Resume.pdf", version: 1, url: "/api/resumes/Uday_Varmora_Netflix_DevOps_Resume.pdf", mtime: "2026-06-25T10:00:00.000Z", company: "Netflix", role: "DevOps Engineer" },
  ] },
];
