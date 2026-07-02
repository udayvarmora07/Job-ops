/**
 * lib-outreach/verify.mjs — email verification (the anti-spam linchpin).
 *
 * Cheapest/safest first: syntax -> MX -> provider verify. Hunter's verifier is
 * the primary provider (100 free/mo); ZeroBounce is precious (small free tier)
 * so it only runs on `deep` or when Hunter returns nothing. A `valid`,
 * non-role-based result is the only thing the composer is allowed to draft to.
 *
 * See SENDER_SAFETY.md §2: bounce rate > 2% is the #1 reputation killer, and it
 * is 100% preventable by never drafting to an unverified address.
 */

import dns from 'dns';
import { KEYS } from './keys.mjs';

const resolveMx = dns.promises.resolveMx;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Generic function mailboxes — deliverable but low-engagement (guide §7.4).
const ROLE_LOCALS = new Set([
  'info', 'support', 'admin', 'hello', 'contact', 'sales', 'careers', 'career',
  'jobs', 'hr', 'team', 'help', 'office', 'mail', 'noreply', 'no-reply',
  'recruiting', 'recruitment', 'talent', 'hiring', 'people', 'billing', 'press',
]);

export function syntaxValid(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

export function isRoleBased(email) {
  const lp = String(email || '').split('@')[0].toLowerCase();
  return ROLE_LOCALS.has(lp);
}

export async function mxLookup(domain) {
  try {
    const r = await resolveMx(domain);
    return Array.isArray(r) && r.length ? r.sort((a, b) => a.priority - b.priority) : [];
  } catch {
    return [];
  }
}

/* ---- provider verifiers (each tries its key pool, returns null on total fail) ---- */

export async function hunterVerify(email) {
  for (const k of KEYS.hunter()) {
    try {
      const r = await fetch(
        `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${k}`
      );
      if (!r.ok) continue;
      const d = (await r.json())?.data;
      if (!d) continue;
      return {
        provider: 'hunter',
        status: d.status,                 // valid|invalid|accept_all|webmail|disposable|unknown
        result: d.result,
        score: d.score,
        acceptAll: d.accept_all === true || d.status === 'accept_all',
        disposable: d.disposable === true,
      };
    } catch { /* next key */ }
  }
  return null;
}

export async function bouncerVerify(email) {
  for (const k of KEYS.bouncer()) {
    try {
      const r = await fetch(
        `https://api.usebouncer.com/v1.1/email/verify?email=${encodeURIComponent(email)}`,
        { headers: { 'x-api-key': k } }
      );
      if (!r.ok) continue;
      const j = await r.json();
      if (!j || !j.status) continue;
      return {
        provider: 'bouncer',
        status: j.status,                 // deliverable|risky|undeliverable|unknown
        reason: j.reason,
        score: j.score,
        acceptAll: j.domain?.acceptAll === 'yes',
        roleBased: j.account?.role === 'yes',
        disposable: j.domain?.disposable === 'yes',
      };
    } catch { /* next key */ }
  }
  return null;
}

export async function zerobounceVerify(email) {
  for (const k of KEYS.zerobounce()) {
    try {
      const r = await fetch(
        `https://api.zerobounce.net/v2/validate?api_key=${k}&email=${encodeURIComponent(email)}&ip_address=`
      );
      if (!r.ok) continue;
      const j = await r.json();
      if (!j || j.error) continue;
      return {
        provider: 'zerobounce',
        status: j.status,                 // valid|invalid|catch-all|spamtrap|abuse|do_not_mail|unknown
        subStatus: j.sub_status,
        acceptAll: j.status === 'catch-all' || j.catchall_domain === true,
        free: j.free_email === true,
      };
    } catch { /* next key */ }
  }
  return null;
}

const NORM_HUNTER = {
  valid: 'valid', invalid: 'invalid', accept_all: 'catch-all',
  webmail: 'valid', disposable: 'disposable', unknown: 'unknown',
};
const NORM_ZB = {
  valid: 'valid', invalid: 'invalid', 'catch-all': 'catch-all',
  spamtrap: 'risky', abuse: 'risky', do_not_mail: 'risky', unknown: 'unknown',
};
const NORM_BOUNCER = {
  deliverable: 'valid', undeliverable: 'invalid', risky: 'risky', unknown: 'unknown',
};

/**
 * Full verification. Returns a normalized status:
 *   valid | invalid | catch-all | disposable | risky | unknown
 * plus mx / syntax / roleBased flags and the raw provider results.
 */
export async function verifyEmail(email, opts = {}) {
  email = String(email || '').trim().toLowerCase();
  const res = {
    email, syntax: false, mx: false, roleBased: false,
    status: 'unknown', catchAll: false, providers: [],
  };

  res.syntax = syntaxValid(email);
  if (!res.syntax) { res.status = 'invalid'; return res; }

  res.roleBased = isRoleBased(email);
  const domain = email.split('@')[1];
  const mx = await mxLookup(domain);
  res.mx = mx.length > 0;
  if (!res.mx) { res.status = 'invalid'; return res; } // no mail server -> hard bounce

  // Primary: Hunter (generous free tier).
  const h = await hunterVerify(email);
  if (h) {
    res.providers.push(h);
    res.status = NORM_HUNTER[h.status] || 'unknown';
    if (h.acceptAll) res.catchAll = true;
    if (h.disposable) res.status = 'disposable';
  }

  // Secondary verifiers — only when asked (deep) or Hunter gave nothing.
  // Bouncer first (generous free credits); ZeroBounce last (tiny 5-credit tier).
  if (opts.deep || !h) {
    const b = await bouncerVerify(email);
    if (b) {
      res.providers.push(b);
      if (b.acceptAll) res.catchAll = true;
      if (b.roleBased) res.roleBased = true;
      if (b.disposable) res.status = 'disposable';
      const n = NORM_BOUNCER[b.status] || 'unknown';
      if (!h || res.status === 'unknown' || res.status === 'catch-all') {
        if (n === 'valid' || n === 'invalid' || n === 'risky') res.status = n;
      }
    }
    // ZeroBounce only if STILL inconclusive — protects its tiny free tier.
    if (res.status === 'unknown' || (!h && !b)) {
      const z = await zerobounceVerify(email);
      if (z) {
        res.providers.push(z);
        const n = NORM_ZB[z.status] || 'unknown';
        if (z.acceptAll) res.catchAll = true;
        if (res.status === 'unknown' || res.status === 'catch-all') {
          if (n === 'valid' || n === 'invalid' || n === 'risky') res.status = n;
          else if (n === 'catch-all') res.status = 'catch-all';
        }
      }
    }
  }

  // A catch-all domain can never be *confirmed* valid — cap it at "catch-all".
  if (res.catchAll && res.status === 'valid') res.status = 'catch-all';
  return res;
}
