import { CandidateProfile, loadProfile } from "./profile";

/**
 * Referral suggestion engine — persona + smart-search-link mode.
 *
 * We do NOT scrape or fabricate real named people. Instead, for a given job we
 * rank the *kinds* of people worth asking (peer / hiring manager / recruiter /
 * same-location-or-alumni), score each persona for THIS role + company + the
 * user's profile, recommend the least-awkward next step, hand back ready-made
 * LinkedIn / Google people-search links, and draft both an "insight-first" and
 * a "referral-ask" message. The user clicks through, finds the real person, and
 * sends after editing. Manual-review-first by design.
 */

export type PersonaType = "peer" | "manager" | "recruiter" | "same_location";

export type AskType =
  | "referral_now"
  | "insight_first"
  | "is_hiring"
  | "recruiter_intro";

export type Confidence = "high" | "medium" | "low";

export const ASK_LABELS: Record<AskType, string> = {
  referral_now: "Ask for a referral now",
  insight_first: "Ask for a 10-min insight first",
  is_hiring: "Ask if the team is hiring actively",
  recruiter_intro: "Ask for a recruiter intro",
};

export const PERSONA_LABELS: Record<PersonaType, string> = {
  peer: "Peer engineer",
  manager: "Hiring manager / lead",
  recruiter: "Recruiter / TA",
  same_location: "Same-location / alumni",
};

export interface DraftMessage {
  intent: "insight" | "referral";
  label: string;
  linkedin: string; // short DM, fits a connection note
  emailSubject: string;
  emailBody: string;
}

export interface Suggestion {
  persona: PersonaType;
  personaLabel: string;
  titleQuery: string; // boolean title string used in searches
  score: number; // 0-100
  scoreBreakdown: { label: string; value: number; weight: number }[];
  confidence: Confidence;
  recommendedAsk: AskType;
  recommendedAskLabel: string;
  reasons: string[];
  linkedinUrl: string;
  googleUrl: string;
  drafts: DraftMessage[];
}

export interface SuggestInput {
  company: string;
  role: string;
  location?: string;
  jobUrl?: string;
}

export interface SuggestResult {
  company: string;
  role: string;
  pitchLine: string;
  roleMatch: number; // 0-1, how well this role fits the candidate
  locationMatch: boolean;
  suggestions: Suggestion[]; // ranked, highest score first
  buckets: {
    askNow: Suggestion[];
    buildFirst: Suggestion[];
    recruiterFallback: Suggestion[];
  };
}

/* ------------------------------------------------------------------ */
/* Title queries per persona (DevOps/SRE cluster aware)                */
/* ------------------------------------------------------------------ */

const PEER_TITLES = [
  "Site Reliability",
  "SRE",
  "DevOps",
  "Platform Engineer",
  "Cloud Engineer",
  "Infrastructure Engineer",
];
const MANAGER_TITLES = [
  "Engineering Manager",
  "DevOps Manager",
  "SRE Manager",
  "Platform Lead",
  "Head of Infrastructure",
  "Director of Engineering",
];
const RECRUITER_TITLES = [
  "Technical Recruiter",
  "Talent Acquisition",
  "Tech Recruiter",
  "Recruiter",
];

function boolOr(titles: string[]): string {
  return `(${titles.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ")})`;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

// Blueprint weighting: role 35, warmth 20, location 15, influence 15, reply 15.
const WEIGHTS = {
  role: 0.35,
  warmth: 0.2,
  location: 0.15,
  influence: 0.15,
  reply: 0.15,
};

// Persona baselines for the dimensions that don't depend on the specific job.
const PERSONA_BASE: Record<
  PersonaType,
  { warmth: number; influence: number; reply: number }
> = {
  peer: { warmth: 0.55, influence: 0.6, reply: 0.8 },
  manager: { warmth: 0.35, influence: 1.0, reply: 0.5 },
  recruiter: { warmth: 0.3, influence: 0.5, reply: 0.75 },
  same_location: { warmth: 0.8, influence: 0.4, reply: 0.65 },
};

/** How well the job role matches the candidate's stack/target roles (0-1). */
export function roleMatchScore(role: string, p: CandidateProfile): number {
  const text = role.toLowerCase();
  if (!text.trim()) return 0.6; // unknown role -> assume plausible fit
  let hits = 0;
  const seen = new Set<string>();
  for (const tok of p.stack) {
    if (seen.has(tok)) continue;
    seen.add(tok);
    if (text.includes(tok)) hits++;
  }
  // Role strings are short titles: 1 stack hit already signals a real match.
  if (hits === 0) return 0.3;
  return Math.min(1, 0.4 + 0.3 * hits); // 1→0.7, 2→1.0

}

function locationMatchScore(
  location: string | undefined,
  p: CandidateProfile
): boolean {
  if (!location) return false;
  const text = location.toLowerCase();
  if (/\bremote\b/.test(text)) return true;
  if (p.city && text.includes(p.city.toLowerCase())) return true;
  if (p.country && text.includes(p.country.toLowerCase())) return true;
  return false;
}

function confidenceFor(score: number): Confidence {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function recommendAsk(
  persona: PersonaType,
  score: number,
  roleMatch: number
): AskType {
  if (persona === "recruiter") return "recruiter_intro";
  if (persona === "peer") {
    return score >= 68 && roleMatch >= 0.66 ? "referral_now" : "insight_first";
  }
  if (persona === "manager") {
    return score >= 72 ? "referral_now" : "insight_first";
  }
  // same_location / alumni: warmth bridge, start soft
  return roleMatch < 0.5 ? "is_hiring" : "insight_first";
}

/* ------------------------------------------------------------------ */
/* Search URLs                                                         */
/* ------------------------------------------------------------------ */

function linkedinPeopleSearch(company: string, titleQuery: string): string {
  // LinkedIn's company facet needs a numeric id, so keyword search is the
  // reliable path: company name + persona titles in the global people search.
  const keywords = `${company} ${titleQuery}`.trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
    keywords
  )}&origin=GLOBAL_SEARCH_HEADER`;
}

function googleXray(company: string, titleQuery: string): string {
  const q = `site:linkedin.com/in "${company}" ${titleQuery}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/* ------------------------------------------------------------------ */
/* Message drafts                                                      */
/* ------------------------------------------------------------------ */

const NAME_SLOT = "[their name]";

function shortRoleNoun(p: CandidateProfile): string {
  return p.headline.split(/[—,;]/)[0].trim() || "DevOps/SRE engineer";
}

function buildDrafts(
  persona: PersonaType,
  input: SuggestInput,
  p: CandidateProfile
): DraftMessage[] {
  const role = input.role || "the role";
  const company = input.company;
  const me = shortRoleNoun(p);
  const where = p.city ? ` based in ${p.city}` : "";
  const proof = p.proofMetric ? ` (${p.proofMetric})` : "";
  const sig = p.name && p.name !== "the candidate" ? `\n\n— ${p.name}` : "";

  const insightLinkedIn = (() => {
    switch (persona) {
      case "recruiter":
        return `Hi ${NAME_SLOT}, I'm ${p.name || "an engineer"}, a ${me}${where}. I'm interested in the ${role} opening at ${company} — is it still active, and are you the right person to talk to about it? Happy to share my CV.`;
      case "manager":
        return `Hi ${NAME_SLOT}, I'm ${p.name || "an engineer"}, a ${me}${where}. I'm exploring the ${role} role on your team at ${company}. Would you be open to a brief 10-min chat about what the team is tackling? I'd rather understand the team before applying than send a cold application.`;
      case "same_location":
        return `Hi ${NAME_SLOT}, fellow ${p.city || "local"} engineer here — I'm a ${me}. I noticed you're at ${company}; I'm looking at the ${role} role there and would love 10 minutes to hear what it's like on the inside. Would really appreciate it.`;
      default:
        return `Hi ${NAME_SLOT}, I'm a ${me}${where} and came across the ${role} opening at ${company}. Your work on the team caught my eye — would you be open to a quick 10-min chat about what you're building? No ask beyond that, just trying to learn before I apply.`;
    }
  })();

  const referralLinkedIn = (() => {
    switch (persona) {
      case "recruiter":
        return `Hi ${NAME_SLOT}, I'm a ${me}${proof}. I'd like to formally apply for the ${role} role at ${company} — could you point me to the right step, or flag my profile to the hiring team? Happy to send my CV and a one-line summary.`;
      case "manager":
        return `Hi ${NAME_SLOT}, I'm a ${me}${proof}. I'm applying for the ${role} role on your team at ${company} and believe my CI/CD + Kubernetes background is a strong fit. Would you be open to me applying with your awareness, or to a short call first? I can send a one-line summary you can keep on file.`;
      case "same_location":
        return `Hi ${NAME_SLOT}, ${p.city || "local"} engineer here — I'm a ${me}${proof}. I'm applying for the ${role} role at ${company}. Since you're inside, would you feel comfortable referring me or pointing me to the right person? Happy to send my CV and a one-liner you can forward.`;
      default:
        return `Hi ${NAME_SLOT}, I'm a ${me}${proof}. I'm applying for the ${role} role at ${company} and think my background is a strong fit. Since you're on or near the team, would you feel comfortable referring me — or pointing me to the right person? Happy to send my CV and a one-line summary you can forward.`;
    }
  })();

  const insightBody = `Hi ${NAME_SLOT},\n\n${insightLinkedIn.replace(/^Hi \[their name\], /, "")}${sig}`;
  const referralBody = `Hi ${NAME_SLOT},\n\n${referralLinkedIn.replace(/^Hi \[their name\], /, "")}${sig}`;

  return [
    {
      intent: "insight",
      label: "Insight-first (warm opener)",
      linkedin: insightLinkedIn,
      emailSubject: `Quick question about the ${role} team at ${company}`,
      emailBody: insightBody,
    },
    {
      intent: "referral",
      label: "Referral ask (direct)",
      linkedin: referralLinkedIn,
      emailSubject: `Referral for the ${role} role at ${company}?`,
      emailBody: referralBody,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

function buildSuggestion(
  persona: PersonaType,
  titles: string[],
  input: SuggestInput,
  p: CandidateProfile,
  roleMatch: number,
  locMatch: boolean
): Suggestion {
  const base = PERSONA_BASE[persona];

  // Peers are judged directly on role fit; manager/recruiter indirectly.
  const roleDim =
    persona === "peer"
      ? roleMatch
      : persona === "recruiter"
        ? 0.5 + roleMatch * 0.3
        : 0.4 + roleMatch * 0.5;

  // The same-location persona only earns its warmth premium when location
  // actually overlaps; otherwise the "shared context" premise is unproven and
  // it shouldn't outrank a real peer.
  const warmthDim =
    persona === "same_location"
      ? locMatch
        ? 0.85
        : 0.4
      : base.warmth;

  const locDim = locMatch ? (persona === "same_location" ? 1 : 0.7) : 0.25;

  const dims = {
    role: roleDim,
    warmth: warmthDim,
    location: locDim,
    influence: base.influence,
    reply: base.reply,
  };

  const score = Math.round(
    (dims.role * WEIGHTS.role +
      dims.warmth * WEIGHTS.warmth +
      dims.location * WEIGHTS.location +
      dims.influence * WEIGHTS.influence +
      dims.reply * WEIGHTS.reply) *
      100
  );

  const scoreBreakdown = [
    { label: "Role match", value: dims.role, weight: WEIGHTS.role },
    { label: "Warmth", value: dims.warmth, weight: WEIGHTS.warmth },
    { label: "Location", value: dims.location, weight: WEIGHTS.location },
    { label: "Influence", value: dims.influence, weight: WEIGHTS.influence },
    { label: "Reply odds", value: dims.reply, weight: WEIGHTS.reply },
  ];

  const recommendedAsk = recommendAsk(persona, score, roleMatch);

  const reasons: string[] = [];
  if (persona === "peer")
    reasons.push("Peers judge role fit well and answer most often.");
  if (persona === "manager")
    reasons.push("Highest influence on the interview decision.");
  if (persona === "recruiter")
    reasons.push("Best for process clarity and routing your profile.");
  if (persona === "same_location")
    reasons.push("Shared-location warmth bridge when direct relevance is thinner.");
  if (roleMatch >= 0.66)
    reasons.push("Strong stack overlap with the role — you can be explained in one line.");
  else if (roleMatch < 0.5)
    reasons.push("Looser role match — lead with an informational ask, not a referral.");
  if (locMatch) reasons.push("Location overlaps (same city/region or remote).");

  const titleQuery = boolOr(titles);

  return {
    persona,
    personaLabel: PERSONA_LABELS[persona],
    titleQuery,
    score,
    scoreBreakdown,
    confidence: confidenceFor(score),
    recommendedAsk,
    recommendedAskLabel: ASK_LABELS[recommendedAsk],
    reasons,
    linkedinUrl: linkedinPeopleSearch(input.company, titleQuery),
    googleUrl: googleXray(input.company, titleQuery),
    drafts: buildDrafts(persona, input, p),
  };
}

export function suggestReferrals(
  input: SuggestInput,
  profile: CandidateProfile | null = null,
): SuggestResult {
  const p = profile || loadProfile();
  const roleMatch = roleMatchScore(input.role, p);
  const locMatch = locationMatchScore(input.location, p);

  const peerTitles = input.role
    ? [input.role, ...PEER_TITLES]
    : PEER_TITLES;

  const suggestions = [
    buildSuggestion("peer", peerTitles.slice(0, 6), input, p, roleMatch, locMatch),
    buildSuggestion("manager", MANAGER_TITLES, input, p, roleMatch, locMatch),
    buildSuggestion("recruiter", RECRUITER_TITLES, input, p, roleMatch, locMatch),
    buildSuggestion("same_location", peerTitles.slice(0, 4), input, p, roleMatch, locMatch),
  ].sort((a, b) => b.score - a.score);

  const askNow = suggestions.filter((s) => s.recommendedAsk === "referral_now");
  const recruiterFallback = suggestions.filter((s) => s.persona === "recruiter");
  const buildFirst = suggestions.filter(
    (s) => s.recommendedAsk !== "referral_now" && s.persona !== "recruiter"
  );

  return {
    company: input.company,
    role: input.role,
    pitchLine: p.pitchLine || p.headline,
    roleMatch,
    locationMatch: locMatch,
    suggestions,
    buckets: { askNow, buildFirst, recruiterFallback },
  };
}
