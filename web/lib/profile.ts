import fs from "fs";
import { FILES } from "./paths";

/**
 * Candidate profile distilled from config/profile.yml.
 * Drives the referral suggestion scoring + the personalized message drafts.
 * We do a small, tolerant extraction (no YAML dependency in the web app) and
 * fall back to sensible DevOps/SRE defaults so nothing ever crashes.
 */
export interface CandidateProfile {
  name: string;
  firstName: string;
  city: string;
  country: string;
  linkedin: string;
  github: string;
  headline: string;
  targetRoles: string[];
  stack: string[]; // lowercased keyword tokens for role-match scoring
  proofMetric: string; // one quantified win, used in the referral-ask draft
  pitchLine: string; // the "explain me in one sentence" line
}

const DEFAULTS: CandidateProfile = {
  name: "the candidate",
  firstName: "there",
  city: "",
  country: "",
  linkedin: "",
  github: "",
  headline: "DevOps & Cloud Engineer",
  targetRoles: [
    "DevOps Engineer",
    "Site Reliability Engineer",
    "Cloud Engineer",
    "Platform Engineer",
    "Infrastructure Engineer",
  ],
  stack: [
    "devops",
    "sre",
    "site reliability",
    "ci/cd",
    "kubernetes",
    "k8s",
    "terraform",
    "aws",
    "docker",
    "platform",
    "infrastructure",
    "cloud",
    "observability",
    "jenkins",
  ],
  proofMetric: "",
  pitchLine: "",
};

function firstMatch(raw: string, re: RegExp): string | null {
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

/** Collect `- "value"` list items that follow an anchor key line. */
function collectQuotedAfter(raw: string, anchor: RegExp): string[] {
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => anchor.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    const item = line.match(/^\s*-\s*"?([^"\n]+?)"?\s*$/);
    if (item && /^\s/.test(line)) {
      // a nested key (e.g. "- name:") ends the simple-string list
      if (/:\s*$/.test(item[1]) || /:\s+/.test(item[1])) break;
      out.push(item[1].trim());
      continue;
    }
    // stop at the next non-indented, non-list line
    if (line.trim() && !/^\s/.test(line)) break;
  }
  return out;
}

let cache: CandidateProfile | null = null;

export function loadProfile(): CandidateProfile {
  if (cache) return cache;
  let raw: string;
  try {
    raw = fs.readFileSync(FILES.profile(), "utf8");
  } catch {
    cache = DEFAULTS;
    return cache;
  }

  const name = firstMatch(raw, /full_name:\s*"?([^"\n]+?)"?\s*$/im) || DEFAULTS.name;
  const headline =
    firstMatch(raw, /headline:\s*"?([^"\n]+?)"?\s*$/im) || DEFAULTS.headline;
  const city =
    firstMatch(raw, /^\s*city:\s*"?([^"\n]+?)"?\s*$/im) || DEFAULTS.city;
  const country =
    firstMatch(raw, /^\s*country:\s*"?([^"\n]+?)"?\s*$/im) || DEFAULTS.country;
  const linkedin = firstMatch(raw, /linkedin:\s*"?([^"\n]+?)"?\s*$/im) || "";
  const github = firstMatch(raw, /github:\s*"?([^"\n]+?)"?\s*$/im) || "";
  const proofMetric =
    firstMatch(raw, /hero_metric:\s*"?([^"\n]+?)"?\s*$/im) || DEFAULTS.proofMetric;

  const targetRoles = collectQuotedAfter(raw, /^\s*primary:\s*$/im);
  const superpowers = collectQuotedAfter(raw, /^\s*superpowers:\s*$/im);

  const roles = targetRoles.length ? targetRoles : DEFAULTS.targetRoles;

  // Build a lowercased keyword set for role/stack matching. Drop generic words
  // ("engineer", "senior"…) that would otherwise match unrelated titles.
  const STOPWORDS = new Set([
    "engineer",
    "engineering",
    "senior",
    "junior",
    "mid",
    "lead",
    "manager",
    "specialist",
    "associate",
    "and",
    "the",
    "with",
    "for",
    "scaling",
  ]);
  const stackTokens = new Set<string>(DEFAULTS.stack);
  for (const s of [...superpowers, ...roles]) {
    for (const tok of s
      .toLowerCase()
      .split(/[^a-z0-9/+]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))) {
      stackTokens.add(tok);
    }
  }

  const titlePart = name
    .split(/\s+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
  const firstName = titlePart.split(/\s+/)[0] || DEFAULTS.firstName;

  const pitchLine = proofMetric
    ? `${headline} — ${proofMetric}.`
    : headline;

  cache = {
    name: titlePart,
    firstName,
    city,
    country,
    linkedin,
    github,
    headline,
    targetRoles: roles,
    stack: Array.from(stackTokens),
    proofMetric,
    pitchLine,
  };
  return cache;
}
