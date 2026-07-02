/**
 * lib-outreach/discover-company.mjs — company-wide HR/hiring email discovery.
 *
 * Takes a company name / domain and returns emails for HR and hiring-related
 * people only (recruiters, talent acquisition, people ops, CHRO/CPO, HR
 * generalists, hiring managers, etc.). Non-HR staff are filtered out before
 * verification so we don't waste verifier API credits.
 */

import { hunterDomain, clearbitDomain, apolloDomain, apifyLinkedInHrPeople, mailcheckDomain } from './finders.mjs';
import { verifyEmail } from './verify.mjs';

const looksLikeDomain = (s) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(s || '').trim());

/** All common email formats for a first+last name at a domain, ranked by frequency. */
function namePatterns(first, last, domain) {
  const f = first.toLowerCase().replace(/[^a-z]/g, '');
  const l = last.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];
  return [
    `${f}.${l}@${domain}`,
    `${f[0]}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `${f}_${l}@${domain}`,
    `${f}@${domain}`,
  ];
}

/** Generic HR / hiring mailboxes used as last-resort when no named contact is found. */
const GENERIC_HR = ['hr', 'careers', 'recruitment', 'talent', 'hiring', 'jobs'];

const STATUS_W = { valid: 1, 'catch-all': 0.55, unknown: 0.5, risky: 0.3, disposable: 0.1, invalid: 0 };

// Title keywords that indicate HR / hiring role (checked against lowercased position).
const HR_TITLE_KEYWORDS = [
  'hr', 'human resource', 'human capital',
  'hiring', 'hire',
  'recruit', 'recruitment', 'recruiting',
  'talent acquisition', 'talent partner', 'talent lead', 'talent manager',
  'talent director', 'head of talent', 'vp talent', 'vp of talent',
  'people ops', 'people operation', 'people partner', 'people lead',
  'people manager', 'head of people', 'vp people', 'vp of people',
  'director of people', 'director of talent', 'director of hr',
  'hrbp', 'hr business partner', 'hr generalist', 'hr manager',
  'hr director', 'hr lead', 'hr specialist',
  'chief people', 'chief human', 'chro', 'cpo',
  'campus recruit', 'university recruit', 'early career',
  'staffing', 'workforce',
  'sourcer', 'sourcing',
];

// Generic mailbox locals that are HR / hiring inboxes (role-based, but still
// useful as a fallback when no named person is found).
const HR_GENERIC_LOCALS = new Set([
  'hr', 'careers', 'career', 'jobs', 'job',
  'recruiting', 'recruitment', 'recruiter',
  'talent', 'hiring', 'people', 'apply', 'applications',
  'join', 'joinus',
]);

// Title keywords that indicate a founder / C-suite / leadership role.
const FOUNDER_TITLE_KEYWORDS = [
  'founder', 'co-founder', 'cofounder',
  'ceo', 'chief executive',
  'cto', 'chief technology', 'chief technical',
  'coo', 'chief operating',
  'cmo', 'chief marketing',
  'cfo', 'chief financial',
  'chief product', 'cpo',
  'managing director', 'md',
  'president',
  'owner', 'proprietor',
  'partner',
  'general manager', 'gm',
  'head of engineering', 'vp engineering', 'vp of engineering',
  'head of product', 'vp product', 'vp of product',
  'director of engineering', 'director of technology',
];

/**
 * Returns true if the indexed email entry looks like an HR / hiring contact.
 * @param {{ email: string, position?: string, type?: string }} entry
 */
function isHrRelated(entry) {
  const { email, position, type } = entry;

  // Named person with an HR title — highest value.
  if (position) {
    const p = position.toLowerCase();
    if (HR_TITLE_KEYWORDS.some((k) => p.includes(k))) return true;
  }

  // Generic mailbox like careers@, jobs@, hr@ — useful fallback.
  if (type === 'generic') {
    const local = String(email || '').split('@')[0].toLowerCase();
    if (HR_GENERIC_LOCALS.has(local)) return true;
  }

  return false;
}

/**
 * Returns true if the indexed email entry looks like a founder / C-suite contact.
 * @param {{ email: string, position?: string, type?: string }} entry
 */
function isFounderRelated(entry) {
  const { position } = entry;
  if (!position) return false;
  const p = position.toLowerCase();
  return FOUNDER_TITLE_KEYWORDS.some((k) => p.includes(k));
}

/**
 * Fallback email discovery when Hunter quota is exhausted.
 * Waterfall: Apollo.io (fast, indexed) → Apify LinkedIn (scrape) → generic HR mailboxes + SMTP.
 * Apollo returns pre-verified emails so no Bouncer credits are needed for those.
 */
async function discoverViaLinkedIn({ company, domain: dom, targetType, steps }) {
  const emptyResult = {
    company: company || null, domain: dom, organization: null,
    pattern: null, acceptAll: false, steps, targetType,
    totalIndexed: 0, totalHr: 0, candidates: [],
  };

  // ── Tier 1: Apollo.io — fast, indexed, pre-verified emails ─────────────────
  if (dom) {
    const apolloHits = await apolloDomain(dom, 10);
    if (apolloHits.length) {
      steps.push('apollo:people-search');
      const candidates = apolloHits.map((p) => {
        const confidence = p.emailStatus === 'verified' ? 90 : 65;
        return {
          email: p.email,
          name: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
          title: p.title || null,
          type: 'personal',
          sources: ['apollo'],
          baseScore: confidence,
          verification: { status: p.emailStatus === 'verified' ? 'valid' : 'unknown', roleBased: false, catchAll: false, mx: true, providers: [{ provider: 'apollo', status: p.emailStatus }] },
          confidence,
          recommended: p.emailStatus === 'verified',
        };
      });
      candidates.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.confidence - a.confidence);
      return {
        company: company || null, domain: dom, organization: null, pattern: null,
        acceptAll: false, steps, targetType,
        totalIndexed: apolloHits.length, totalHr: apolloHits.length,
        candidates, linkedInFallback: true,
      };
    }
    steps.push('apollo:no-results');
  }

  // ── Tier 2: MailCheck.ai MX pre-filter (free) ──────────────────────────────
  if (dom) {
    const mc = await mailcheckDomain(dom);
    steps.push('mailcheck:domain-mx');
    if (mc && !mc.mx) return { ...emptyResult, quotaExceeded: true };
  }

  // ── Tier 3: Apify LinkedIn People Search → pattern generation + SMTP ───────
  const people = await apifyLinkedInHrPeople(company || dom || '', 6);
  steps.push('apify:linkedin-hr-search');

  const candidateEmails = [];
  if (dom) {
    for (const p of people) {
      const patterns = namePatterns(p.firstName, p.lastName, dom).slice(0, 2);
      for (const email of patterns) candidateEmails.push({ email, person: p });
    }
    for (const local of GENERIC_HR) {
      candidateEmails.push({ email: `${local}@${dom}`, person: null });
    }
  }

  if (!candidateEmails.length) return { ...emptyResult, linkedInFallback: true, quotaExceeded: true };

  // Verify top 8 with Bouncer SMTP.
  const verified = [];
  for (const { email, person } of candidateEmails.slice(0, 8)) {
    const v = await verifyEmail(email, { deep: true });
    if (v.status === 'valid' || v.status === 'catch-all' || v.status === 'risky') {
      const w = { valid: 1, 'catch-all': 0.55, risky: 0.3 }[v.status] ?? 0.5;
      verified.push({
        email,
        name: person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : null,
        title: person?.title || null,
        type: person ? 'personal' : 'generic',
        sources: ['apify-linkedin', 'bouncer-smtp'],
        baseScore: Math.round(w * 100),
        verification: v,
        confidence: Math.round(w * 100),
        recommended: v.status === 'valid' && !v.roleBased,
      });
    }
  }
  verified.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.confidence - a.confidence);

  return {
    company: company || null, domain: dom, organization: null, pattern: null,
    acceptAll: false, steps, targetType,
    totalIndexed: people.length, totalHr: people.length,
    candidates: verified, linkedInFallback: true,
  };
}

/**
 * Find HR/hiring or founder/leadership emails at a company domain, verified
 * and ranked by confidence percentage.
 *
 * @param {{ company?: string, domain?: string, deep?: boolean, maxVerify?: number, targetType?: 'hr'|'founder' }} opts
 */
export async function discoverCompany({ company, domain, deep = false, maxVerify = 20, targetType = 'hr' } = {}) {
  let dom = domain
    ? String(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
    : null;
  if (!dom && looksLikeDomain(company)) dom = company.toLowerCase();

  const steps = [];

  // When only a company name is given (no domain), try Clearbit autocomplete first
  // (free, no key needed) so we can pass a real domain to Hunter instead of a name.
  if (!dom && company) {
    const cbd = await clearbitDomain(company);
    if (cbd) { dom = cbd; steps.push('clearbit:domain-resolve'); }
  }

  const ds = await hunterDomain(dom, dom ? null : company);

  // Hunter quota exhausted → fall back to LinkedIn People Search + pattern + SMTP.
  if (ds?.__quotaExceeded) {
    return discoverViaLinkedIn({ company, domain: dom, targetType, steps });
  }

  if (!dom && ds?.domain) dom = ds.domain;
  if (ds) steps.push('hunter:domain-search');

  const pattern = ds?.pattern || null;
  const acceptAll = ds?.acceptAll || false;

  // All indexed emails at the domain, before any filter.
  const allIndexed = ds?.emails || [];

  // Filter by target type, then sort by Hunter confidence.
  const filterFn = targetType === 'founder' ? isFounderRelated : isHrRelated;
  const filteredIndexed = allIndexed
    .filter(filterFn)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const toVerify = filteredIndexed.slice(0, maxVerify);
  const candidates = [];

  for (const e of toVerify) {
    const v = await verifyEmail(e.email, { deep });
    const w = STATUS_W[v.status] ?? 0.5;
    const hunterConf = (e.confidence || 50) / 100;
    const confidence = Math.round(Math.min(100, hunterConf * 100 * 0.6 + w * 100 * 0.4));
    candidates.push({
      email: e.email,
      name: [e.firstName, e.lastName].filter(Boolean).join(' ') || null,
      title: e.position || null,
      type: e.type || null,
      sources: ['hunter-indexed'],
      baseScore: e.confidence || 50,
      verification: v,
      confidence,
      recommended: v.status === 'valid' && !v.roleBased,
    });
  }

  candidates.sort(
    (a, b) => Number(b.recommended) - Number(a.recommended) || b.confidence - a.confidence
  );

  return {
    company: company || null,
    domain: dom,
    organization: ds?.organization || null,
    pattern,
    acceptAll,
    steps,
    targetType,
    totalIndexed: allIndexed.length,
    totalHr: filteredIndexed.length,
    candidates,
  };
}
