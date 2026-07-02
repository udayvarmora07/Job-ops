/**
 * lib-outreach/finders.mjs — email discovery adapters (one interface per source).
 *
 * Every adapter tries its key pool in order (failover) and returns null on total
 * failure, so the orchestrator can stack sources without caring which keys exist.
 *
 *   Hunter  — domain-search (pattern + indexed emails) + email-finder   (GET, api_key)
 *   Prospeo — enrich-person                                             (POST, X-KEY)
 *   Snov    — emails-by-domain-by-name (async start/poll)               (OAuth Bearer)
 */

import { KEYS } from './keys.mjs';

const cleanDomain = (d) =>
  String(d || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

/* --------------------------------- Hunter --------------------------------- */

/**
 * Resolve a company name → domain using Clearbit's free autocomplete API
 * (no key required, no rate limit in practice). Returns the best-match domain
 * or null if the lookup fails / returns no results.
 */
export async function clearbitDomain(company) {
  try {
    const r = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }
    );
    if (!r.ok) return null;
    const results = await r.json();
    return results?.[0]?.domain || null;
  } catch { return null; }
}

/** Domain → email pattern + catch-all flag + indexed emails. Resolves a domain
 *  from a company name when `domain` is null.
 *  Returns `{ __quotaExceeded: true }` when all keys are rate-limited (HTTP 429)
 *  so callers can surface a helpful error instead of silently showing empty. */
export async function hunterDomain(domain, company) {
  const q = domain
    ? `domain=${encodeURIComponent(cleanDomain(domain))}`
    : `company=${encodeURIComponent(company || '')}`;
  let anyQuotaError = false;
  for (const k of KEYS.hunter()) {
    try {
      const r = await fetch(`https://api.hunter.io/v2/domain-search?${q}&limit=10&api_key=${k}`);
      if (r.status === 429) { anyQuotaError = true; continue; } // quota hit → try next key
      if (!r.ok) continue;
      const d = (await r.json())?.data;
      if (!d) continue;
      return {
        domain: d.domain,
        pattern: d.pattern || null,
        acceptAll: d.accept_all === true,
        organization: d.organization || null,
        emails: (d.emails || []).map((e) => ({
          email: e.value,
          confidence: e.confidence,
          firstName: e.first_name,
          lastName: e.last_name,
          position: e.position,
          type: e.type,
        })),
      };
    } catch { /* next key */ }
  }
  return anyQuotaError ? { __quotaExceeded: true } : null;
}

/* --------------------------------- Apollo.io ------------------------------ */

/** HR titles to filter people search results — subset of roles relevant for cold outreach. */
const APOLLO_HR_TITLES = [
  'recruiter', 'talent acquisition', 'human resources', 'hr manager',
  'hr director', 'hr generalist', 'hr business partner', 'hrbp',
  'people operations', 'people partner', 'head of talent', 'head of people',
  'hiring manager', 'talent partner', 'campus recruiter', 'sourcer',
];

/**
 * Search Apollo.io for HR/recruiting people at a domain.
 * Returns array of { email, firstName, lastName, title, confidence } objects.
 * Apollo returns pre-verified emails — no SMTP credits needed.
 */
export async function apolloDomain(domain, maxResults = 10) {
  const keys = KEYS.apollo();
  if (!keys.length) return [];
  const dom = cleanDomain(domain);

  for (const key of keys) {
    try {
      const r = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': key,
        },
        body: JSON.stringify({
          q_organization_domains: dom,
          person_titles: APOLLO_HR_TITLES,
          contact_email_status_cd: ['verified', 'likely to engage', 'unavailable'],
          per_page: maxResults,
          page: 1,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (r.status === 403) return []; // plan-restricted: all keys on same plan, bail early
      if (r.status === 401) continue;  // invalid key → try next
      if (!r.ok) continue;
      const j = await r.json();
      const people = j?.people || j?.contacts || [];
      if (!people.length) return []; // empty domain or no HR people indexed
      return people
        .filter((p) => p.email)
        .slice(0, maxResults)
        .map((p) => ({
          email: (p.email || '').toLowerCase(),
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          title: p.title || p.headline || '',
          confidence: p.email_status === 'verified' ? 90 : 65,
          emailStatus: p.email_status || 'unknown',
        }));
    } catch { /* next key */ }
  }
  return [];
}

/**
 * Name + domain → single best email from Apollo.io people search.
 * Used as a fast fallback in the per-person find-email flow.
 */
export async function apolloFind(domain, first, last) {
  const keys = KEYS.apollo();
  if (!keys.length) return null;
  const dom = cleanDomain(domain);

  for (const key of keys) {
    try {
      const r = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': key,
        },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          organization_domain: dom,
          reveal_personal_emails: false,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (r.status === 403) return null; // plan-restricted: bail early, don't try remaining keys
      if (r.status === 401) continue;    // invalid key → try next
      if (!r.ok) continue;
      const j = await r.json();
      const email = j?.person?.email;
      if (!email) continue;
      return {
        source: 'apollo',
        email: email.toLowerCase(),
        status: j.person.email_status || 'unknown',
        confidence: j.person.email_status === 'verified' ? 90 : 65,
      };
    } catch { /* next key */ }
  }
  return null;
}

/* ----------------------- People Data Labs (PDL) --------------------------- */

/**
 * Name + company/domain → person record from PDL.
 * Returns { email, title, linkedinUrl, confidence } or null.
 * Credits only consumed when a record IS found (404 = no cost).
 */
export async function pdlFind(domain, first, last) {
  const keys = KEYS.pdl();
  if (!keys.length) return null;
  const params = new URLSearchParams({
    first_name: first,
    last_name: last,
    company: domain,   // PDL accepts domain as company identifier
    pretty: 'false',
  });
  for (const key of keys) {
    try {
      const r = await fetch(
        `https://api.peopledatalabs.com/v5/person/enrich?${params}`,
        { headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(8_000) }
      );
      if (r.status === 401 || r.status === 403) continue;
      if (r.status === 404) return null; // person not in PDL — no credit used
      if (!r.ok) continue;
      const j = await r.json();
      const p = j?.data;
      if (!p) continue;
      const email = p.work_email || p.emails?.[0]?.address || null;
      if (!email) return null;
      return {
        source: 'pdl',
        email: email.toLowerCase(),
        title: p.job_title || '',
        linkedinUrl: p.linkedin_url || null,
        confidence: p.work_email ? 88 : 65,
      };
    } catch { /* next key */ }
  }
  return null;
}

/**
 * Company domain → list of HR/recruiting people from PDL person search.
 * Uses PDL's SQL-like search API. Returns array of { email, firstName, lastName, title }.
 * Credits consumed per matched record returned.
 */
export async function pdlDomain(domain, maxResults = 10) {
  const keys = KEYS.pdl();
  if (!keys.length) return [];
  const dom = cleanDomain(domain);

  const sql = `SELECT * FROM person WHERE job_company_website='${dom}' AND (job_title_role='human_resources' OR job_title_sub_role='recruiting' OR job_title LIKE '%recruiter%' OR job_title LIKE '%talent%' OR job_title LIKE '%hr %' OR job_title LIKE '%people ops%') LIMIT ${maxResults}`;

  for (const key of keys) {
    try {
      const r = await fetch('https://api.peopledatalabs.com/v5/person/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
        body: JSON.stringify({ sql, size: maxResults, pretty: false }),
        signal: AbortSignal.timeout(10_000),
      });
      if (r.status === 401 || r.status === 403) continue;
      if (!r.ok) continue;
      const j = await r.json();
      const people = j?.data || [];
      if (!people.length) return []; // no HR people indexed at this domain
      return people
        .filter((p) => p.work_email || p.emails?.length)
        .map((p) => ({
          email: (p.work_email || p.emails?.[0]?.address || '').toLowerCase(),
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          title: p.job_title || '',
          linkedinUrl: p.linkedin_url || null,
          confidence: p.work_email ? 88 : 65,
        }))
        .filter((p) => p.email);
    } catch { /* next key */ }
  }
  return [];
}

/* ----------------------- MailCheck.ai (free, no key) ---------------------- */

/** Domain-level MX / disposable / spam check. Returns null on failure.
 *  Rate-limit: generous (no documented limit), but not a per-email SMTP check. */
export async function mailcheckDomain(domain) {
  try {
    const r = await fetch(
      `https://mailcheck.ai/api/v1/?domain=${encodeURIComponent(domain)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return { mx: j.mx === true, disposable: j.disposable === true, spam: j.spam === true };
  } catch { return null; }
}

/* ----------------------- Apify LinkedIn People Search -------------------- */

/** Search LinkedIn for HR/recruiting people at `company` via Apify actor.
 *  Actor: LinkedIn People Search Scraper (G7tBo2F76GVJobj1T)
 *  Returns array of { firstName, lastName, title } — no emails.
 *  Credits: each run ~1 Apify compute unit (3 tokens available). */
export async function apifyLinkedInHrPeople(company, maxResults = 6) {
  const tokens = KEYS.apify();
  if (!tokens.length) return [];

  const searchUrl =
    'https://www.linkedin.com/search/results/people/?' +
    `keywords=${encodeURIComponent('recruiter OR "talent acquisition" OR "HR"')}` +
    `&company=${encodeURIComponent(company)}`;

  for (const token of tokens) {
    try {
      // Use run-sync-get-dataset-items for a single synchronous call (60s max).
      const r = await fetch(
        'https://api.apify.com/v2/acts/G7tBo2F76GVJobj1T/run-sync-get-dataset-items' +
        '?timeout=55&memory=512',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchUrl, maxResults }),
          signal: AbortSignal.timeout(65_000),
        }
      );
      if (!r.ok) continue;
      const items = await r.json();
      if (!Array.isArray(items) || !items.length) continue;

      return items.slice(0, maxResults).map((p) => {
        const fullName = p.fullName || p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim();
        const parts = fullName.split(' ');
        return {
          firstName: p.firstName || parts[0] || '',
          lastName: p.lastName || parts.slice(1).join(' ') || '',
          title: p.title || p.headline || p.jobTitle || '',
        };
      }).filter((p) => p.firstName);
    } catch { /* next token */ }
  }
  return [];
}

/** Name + domain → single best email + Hunter's confidence score. */
export async function hunterFind(domain, first, last) {
  const dom = cleanDomain(domain);
  for (const k of KEYS.hunter()) {
    try {
      const r = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(dom)}` +
        `&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${k}`
      );
      if (!r.ok) continue;
      const d = (await r.json())?.data;
      if (!d || !d.email) continue;
      return { source: 'hunter-finder', email: d.email.toLowerCase(), score: d.score, status: d.verification?.status };
    } catch { /* next key */ }
  }
  return null;
}

/* --------------------------------- Prospeo -------------------------------- */

/** Name + company website → verified email (new enrich-person API). */
export async function prospeoFind(domain, first, last) {
  const website = `https://${cleanDomain(domain)}`;
  for (const k of KEYS.prospeo()) {
    try {
      const r = await fetch('https://api.prospeo.io/enrich-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KEY': k },
        body: JSON.stringify({
          data: { first_name: first, last_name: last, company_website: website },
          only_verified_email: true,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!j || j.error || j.req_status === false) continue; // out of credit / error → next key
      const em = j?.person?.email;
      if (em && em.email) {
        return { source: 'prospeo', email: em.email.toLowerCase(), status: em.status, method: em.verification_method };
      }
      return null; // valid response, simply no email found
    } catch { /* next key */ }
  }
  return null;
}

/* ---------------------------------- Snov ---------------------------------- */

let snovToken = null;
let snovExpiresAt = 0;

export async function snovAuth() {
  const c = KEYS.snov();
  if (!c) return null;
  if (snovToken && Date.now() < snovExpiresAt) return snovToken;
  try {
    const r = await fetch('https://api.snov.io/v1/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(c.id)}&client_secret=${encodeURIComponent(c.secret)}`,
    });
    const j = await r.json();
    if (!j?.access_token) return null;
    snovToken = j.access_token;
    snovExpiresAt = Date.now() + (j.expires_in ? j.expires_in * 1000 : 3_000_000) - 60_000;
    return snovToken;
  } catch {
    return null;
  }
}

/** Name + domain → email (async start/poll flow). */
export async function snovFind(domain, first, last) {
  const t = await snovAuth();
  if (!t) return null;
  const dom = cleanDomain(domain);
  try {
    const s = await fetch('https://api.snov.io/v2/emails-by-domain-by-name/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ first_name: first, last_name: last, domain: dom }] }),
    });
    const hash = (await s.json())?.data?.task_hash;
    if (!hash) return null;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const g = await fetch(
        `https://api.snov.io/v2/emails-by-domain-by-name/result?task_hash=${encodeURIComponent(hash)}`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const gj = await g.json();
      if (gj?.status === 'completed') {
        const hit = gj?.data?.[0]?.result?.[0];
        if (hit && hit.email) {
          return { source: 'snov', email: hit.email.toLowerCase(), status: hit.smtp_status, disposable: hit.is_disposable };
        }
        return null;
      }
    }
  } catch { /* fall through */ }
  return null;
}
