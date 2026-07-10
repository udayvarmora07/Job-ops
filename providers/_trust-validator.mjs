// ── Trust validator ─────────────────────────────────────────────────
// Optional posting-legitimacy heuristic. Enriches every scanned job with a
// trust score (0–100), a level (high/medium/low) and human-readable flags.
// It NEVER drops a job — scan.mjs runs it before the real filters and only uses
// the result for reporting and the optional Ghost-Shield UI. See the
// `trust_filter` block in templates/portals.example.yml for the config schema.
//
// Checks (each subtracts from a starting score of 100):
//   1. Missing application URL          → -60  (nothing to apply to)
//   2. Malformed / non-http(s) URL      → -50  (can't be a real posting)
//   3. Suspicious domain (link shortener / form builder) → -40
//   4. Company ↔ domain mismatch        → -20  (skipped for known ATS hosts)
//
// If the block is absent or `enabled: false`, every job scores 100 (high).

// Link shorteners and generic form builders that a legitimate ATS never uses.
const DEFAULT_SUSPICIOUS_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'forms.gle',
  'goo.gl',
  'shorturl.at',
  'rebrand.ly',
  'cutt.ly',
  'is.gd',
  'ow.ly',
];

// Hosts (matched as suffixes) that are trusted applicant-tracking systems.
// A URL on one of these skips the company↔domain mismatch check because the
// apply domain legitimately differs from the company's own domain.
const DEFAULT_ATS_ALLOWLIST = [
  'greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'ashbyhq.com',
  'jobs.ashbyhq.com',
  'workday.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'recruitee.com',
  'workable.com',
  'jobs.workable.com',
  'bamboohr.com',
  'breezy.hr',
  'teamtailor.com',
  'jobvite.com',
  'icims.com',
  'successfactors.com',
  'taleo.net',
  'linkedin.com',
  'indeed.com',
  'naukri.com',
  'adzuna.in',
  'adzuna.com',
];

const HTTP_SCHEMES = new Set(['http:', 'https:']);

function normList(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);
}

/** Registrable-ish host: strips a leading "www." for friendlier comparisons. */
function cleanHost(hostname) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

/** True when `host` equals or is a subdomain of any suffix in `list`. */
function hostMatches(host, list) {
  return list.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Lowercased alphanumeric tokens (length ≥ 3) from a company name. */
function companyTokens(company) {
  return String(company || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && t !== 'inc' && t !== 'ltd' && t !== 'llc');
}

function levelFor(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * @param {object|undefined} trustFilter  the `trust_filter` block from portals.yml
 * @returns {(job:object) => { score:number, flags:string[], level:string }}
 */
export function buildTrustValidator(trustFilter) {
  // Absent or explicitly disabled → everything is trusted.
  if (!trustFilter || trustFilter.enabled === false) {
    return () => ({ score: 100, flags: [], level: 'high' });
  }

  const suspicious = normList(trustFilter.suspicious_domains, DEFAULT_SUSPICIOUS_DOMAINS);
  const atsAllowlist = normList(trustFilter.ats_allowlist, DEFAULT_ATS_ALLOWLIST);

  return (job) => {
    const flags = [];
    let score = 100;

    const rawUrl = typeof job?.url === 'string' ? job.url.trim() : '';

    // 1. Missing application URL.
    if (!rawUrl) {
      flags.push('missing-apply-url');
      return { score: 40, flags, level: levelFor(40) };
    }

    // 2. Malformed / non-http(s) URL.
    let parsed;
    try {
      parsed = new URL(rawUrl);
      if (!HTTP_SCHEMES.has(parsed.protocol)) throw new Error('non-http scheme');
    } catch {
      flags.push('malformed-url');
      score -= 50;
      return { score: Math.max(0, score), flags, level: levelFor(Math.max(0, score)) };
    }

    const host = cleanHost(parsed.hostname);

    // 3. Suspicious domain (link shortener / form builder).
    if (hostMatches(host, suspicious)) {
      flags.push(`suspicious-domain:${host}`);
      score -= 40;
    }

    // 4. Company ↔ domain mismatch — skipped for known ATS/aggregator hosts.
    if (!hostMatches(host, atsAllowlist)) {
      const tokens = companyTokens(job?.company);
      const domainText = host.replace(/[^a-z0-9]/g, '');
      const related =
        tokens.length === 0 ||
        tokens.some((t) => domainText.includes(t)) ||
        // domain root (e.g. "acme" in acme.com) appearing in the company name
        companyTokens(host.split('.')[0]).some((d) => tokens.includes(d));
      if (!related) {
        flags.push('company-domain-mismatch');
        score -= 20;
      }
    }

    score = Math.max(0, Math.min(100, score));
    return { score, flags, level: levelFor(score) };
  };
}

export default buildTrustValidator;
