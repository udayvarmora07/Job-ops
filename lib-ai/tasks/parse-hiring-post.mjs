/**
 * lib-ai/tasks/parse-hiring-post.mjs — turn a raw LinkedIn hiring post (the kind
 * a recruiter writes: "We're hiring a DevOps Engineer — send your CV to x@y.com")
 * into structured JSON the outreach pipeline can act on.
 *
 * Input is the pasted post text PLUS (optionally) its first comments — the apply
 * email very often lives in the first comment, not the body. A regex pre-pass
 * (extractEmails) guarantees we never lose an address the model overlooks; the
 * model fills in the role/requirements/contact fields.
 *
 * Output (parsed by parseHiringPostJson):
 *   { company, role, location, workMode, seniority, requirements[], mustHaves[],
 *     email, applyMethod, contactName, contactTitle, recruiterType, salary, confidence }
 */

import { read, CLI_RULES } from '../context.mjs';

// Pragmatic email regex — good enough to lift "send CV to name@company.com" out
// of post/comment text. Lowercased + de-duplicated by the caller.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Addresses that are almost never a real apply target — strip obvious noise so
// the model isn't handed junk (LinkedIn/CDN/no-reply system addresses).
const NOISE_DOMAINS = /(?:linkedin\.com|licdn\.com|example\.(?:com|org)|sentry\.io|no-?reply|donotreply)/i;

/** All plausible apply emails found in free text, lowercased, de-duplicated, noise removed. */
export function extractEmails(text = '') {
  const out = [];
  const seen = new Set();
  for (const m of String(text).matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/[.,;:)\]}>'"]+$/, '');
    if (NOISE_DOMAINS.test(e)) continue;
    if (!seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out;
}

/**
 * @param {string|object} input  raw post text, or { post, comments? }
 */
export function buildParseHiringPost(input = {}) {
  const { post = '', comments = '' } =
    typeof input === 'string' ? { post: input } : input;

  const text = String(post || '').trim();
  if (!text) throw new Error('buildParseHiringPost: empty post text.');

  // Give the model the regex-found emails as a strong hint (it must still pick
  // the right ONE, e.g. the apply address vs a personal address mentioned in passing).
  const foundEmails = extractEmails(`${text}\n${comments}`);

  // The candidate's own target roles, so the model can judge fit/relevance.
  const profile = read('config/profile.yml', 'profile');

  const system = `You parse a single LinkedIn "we're hiring" post (written by a company or a
third-party/agency recruiter) into STRICT JSON. These posts announce a role and usually say
where to apply — often an email in the post body OR in the first comment.

OUTPUT RULES (enforced by code):
1. Return ONLY valid JSON. No markdown, no code fences, no prose before or after.
2. Exactly these keys (use "" or [] when unknown — NEVER invent a value):
   {
     "company": string,            // hiring company; if an agency posts for a client, the client if named, else the agency
     "role": string,               // the job title as written
     "location": string,           // city/country if stated
     "workMode": "remote"|"hybrid"|"onsite"|"",
     "seniority": string,          // e.g. "Junior","Mid","Senior","Lead" if inferable, else ""
     "requirements": string[],     // key responsibilities / nice-to-haves, short phrases
     "mustHaves": string[],        // hard requirements (years, must-have tools/certs)
     "email": string,              // THE apply email (lowercase). Pick from the FOUND EMAILS list when present.
     "applyMethod": "email"|"form"|"dm"|"comment"|"unknown",
     "contactName": string,        // recruiter/poster name if stated
     "contactTitle": string,       // their title if stated
     "recruiterType": "inhouse"|"agency"|"unknown",
     "salary": string,             // if stated, else ""
     "confidence": number          // 0..1 — how confident you are this is a real, parseable hiring post
   }
3. EMAIL: prefer an address from the FOUND EMAILS list below. If several, choose the one
   presented as the apply target ("send your resume to ...", "DM/mail at ..."). If the post
   says apply via a form/link, set applyMethod:"form" and email:"". If it says "DM me" or
   "comment interested", set applyMethod accordingly and email:"" (unless an email is also given).
4. recruiterType: "agency" if the poster is a staffing/consulting/recruitment firm posting for a
   client; "inhouse" if they work at the hiring company; else "unknown".
5. Do NOT fabricate company, email, salary, or requirements. Absent → "" or [].

${CLI_RULES}

═══════════════════════════════════════════════════════
CANDIDATE TARGET ROLES (config/profile.yml) — for judging relevance only:
═══════════════════════════════════════════════════════
${profile}`;

  const prompt = `FOUND EMAILS (regex pre-pass; pick the apply address from here when present):
${foundEmails.length ? foundEmails.join('\n') : '(none found in text)'}

HIRING POST:
${text}
${comments ? `\nCOMMENTS (apply email is often here):\n${String(comments).trim()}` : ''}

Return ONLY the JSON object.`;

  return { system, prompt };
}

/** Parse the model's JSON output tolerantly (strips code fences / stray prose). */
export function parseHiringPostJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try { obj = JSON.parse(raw.slice(s, e + 1)); } catch { obj = null; }
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  // Normalise + guarantee shape.
  const arr = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);
  const str = (v) => (v == null ? '' : String(v).trim());
  return {
    company: str(obj.company),
    role: str(obj.role),
    location: str(obj.location),
    workMode: ['remote', 'hybrid', 'onsite'].includes(obj.workMode) ? obj.workMode : '',
    seniority: str(obj.seniority),
    requirements: arr(obj.requirements),
    mustHaves: arr(obj.mustHaves),
    email: str(obj.email).toLowerCase(),
    applyMethod: ['email', 'form', 'dm', 'comment'].includes(obj.applyMethod) ? obj.applyMethod : 'unknown',
    contactName: str(obj.contactName),
    contactTitle: str(obj.contactTitle),
    recruiterType: ['inhouse', 'agency'].includes(obj.recruiterType) ? obj.recruiterType : 'unknown',
    salary: str(obj.salary),
    confidence: typeof obj.confidence === 'number' ? obj.confidence : Number(obj.confidence) || 0,
  };
}
