/**
 * lib-outreach/discover.mjs — the discovery orchestrator.
 *
 * Given a person (name + company/domain), cascade the free-first layers:
 *   1. Hunter domain-search  → email pattern + catch-all flag + indexed emails
 *      (also resolves the domain when only a company name is given)
 *   2. pattern-applied target email (strong signal)
 *   3. finders: Hunter email-finder + Prospeo (parallel); Snov only if still empty
 *   4. name-matched indexed emails from step 1
 *   5. permutations (fallback) when candidates are thin
 * Then VERIFY the top candidates and rank. Nothing is "recommended" unless it
 * verifies `valid` and is not a role mailbox (the composer's draft gate).
 */

import { parseName, permutations, applyPattern } from './permute.mjs';
import { hunterDomain, hunterFind, prospeoFind, snovFind, apolloFind } from './finders.mjs';
import { verifyEmail } from './verify.mjs';

const looksLikeDomain = (s) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(s || '').trim());

// Normalized verification status → weight in the confidence blend.
const STATUS_W = { valid: 1, 'catch-all': 0.55, unknown: 0.5, risky: 0.3, disposable: 0.1, invalid: 0 };

/**
 * @param {{ name?: string, company?: string, domain?: string, deep?: boolean, maxVerify?: number }} [opts]
 */
export async function discover({ name, company, domain, deep = false, maxVerify = 6 } = {}) {
  const { first, last } = parseName(name);
  let dom = domain ? String(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() : null;
  if (!dom && looksLikeDomain(company)) dom = company.toLowerCase();

  const steps = [];

  // 1. Hunter domain-search: pattern + catch-all + indexed emails (+ resolve domain).
  const ds = await hunterDomain(dom, dom ? null : company);
  if (ds) {
    steps.push('hunter:domain-search');
    if (!dom && ds.domain) dom = ds.domain;
  }
  const pattern = ds?.pattern || null;
  const acceptAll = ds?.acceptAll || false;

  /** email -> { email, sources:Set, base:number } */
  const candidates = new Map();
  const add = (email, source, base) => {
    if (!email) return;
    email = email.toLowerCase();
    const c = candidates.get(email) || { email, sources: new Set(), base: 0 };
    c.sources.add(source);
    c.base = Math.max(c.base, base);
    candidates.set(email, c);
  };

  // 2. Pattern applied to the target name (strong when the pattern is known).
  if (pattern && dom && first) {
    const pe = applyPattern(pattern, first, last, dom);
    if (pe) add(pe, 'hunter-pattern', 0.85);
  }

  // 3. Finders (need first+last+domain).
  if (first && last && dom) {
    const [h, p, a] = await Promise.all([hunterFind(dom, first, last), prospeoFind(dom, first, last), apolloFind(dom, first, last)]);
    if (h) { steps.push('hunter:email-finder'); add(h.email, 'hunter-finder', h.score ? h.score / 100 : 0.8); }
    if (p) { steps.push('prospeo:enrich-person'); add(p.email, 'prospeo', p.status === 'VERIFIED' ? 0.95 : 0.75); }
    if (a) { steps.push('apollo:people-match'); add(a.email, 'apollo', a.confidence / 100); }
    if (candidates.size === 0) {
      const s = await snovFind(dom, first, last);
      if (s) { steps.push('snov:finder'); add(s.email, 'snov', 0.7); }
    }
  }

  // 4. Name-matched indexed emails from the domain search.
  if (ds?.emails?.length && first) {
    for (const e of ds.emails) {
      const ef = (e.firstName || '').toLowerCase();
      const el = (e.lastName || '').toLowerCase();
      if (ef === first && (!last || el === last)) add(e.email, 'hunter-indexed', (e.confidence || 70) / 100);
    }
  }

  // 5. Permutations as a fallback when we still have little.
  if (dom && first && candidates.size < 2) {
    for (const perm of permutations(first, last, dom)) add(perm.email, 'permutation', 0.3 * perm.likelihood);
  }

  // Verify the top-N by base score (caps API spend).
  const top = [...candidates.values()].sort((a, b) => b.base - a.base).slice(0, maxVerify);
  const verified = [];
  for (const c of top) {
    const v = await verifyEmail(c.email, { deep });
    const sources = [...c.sources];
    const finderBoost = sources.some((s) => s.includes('finder') || s === 'prospeo' || s === 'snov' || s === 'apollo') ? 10 : 0;
    const w = STATUS_W[v.status] ?? 0.5;
    const confidence = Math.round(Math.min(100, c.base * 100 * 0.6 + w * 100 * 0.4 + finderBoost));
    verified.push({
      email: c.email,
      sources,
      baseScore: Math.round(c.base * 100),
      verification: v,
      confidence,
      recommended: v.status === 'valid' && !v.roleBased,
    });
  }
  verified.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.confidence - a.confidence);

  return {
    name: name || null,
    first, last,
    domain: dom,
    company: company || null,
    organization: ds?.organization || null,
    pattern,
    acceptAll,
    steps,
    candidates: verified,
    best: verified.find((v) => v.recommended) || verified[0] || null,
  };
}
