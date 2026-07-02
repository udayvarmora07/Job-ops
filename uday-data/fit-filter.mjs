/**
 * fit-filter.mjs — experience-fit filter for Uday (1.5 yrs DevOps).
 *
 * DESIGN GOAL: never drop a job Uday could actually fit. A false "drop"
 * (losing a good role) is worse than a false "keep" (one extra role to skim).
 * So we ONLY reject when there is POSITIVE evidence the role wants more
 * experience than he has. Everything ambiguous is KEPT.
 *
 * Signal priority (strongest first):
 *   1. Years-of-experience stated in the JD text  → the truth. Overrides title.
 *   2. LinkedIn jobLevel (Entry/Associate = keep; Director/Executive = drop).
 *   3. Title seniority words (Senior/Staff/Lead/...) → weakest, last resort only
 *      when there's no JD text and no usable level.
 *   4. Nothing disqualifying → KEEP.
 *
 * The title is deliberately the WEAKEST signal: a role titled "Senior" that
 * actually asks for "2+ years" is KEPT (the JD wins). That's the exact mistake
 * we're avoiding.
 */

// Defaults tuned to Uday's profile. Override via opts.
export const DEFAULT_FIT = {
  myYears: 1.5,
  // Keep roles whose stated MINIMUM requirement is <= this. 3 gives headroom:
  // a 1.5-yr candidate realistically reaches into "up to 3 years" postings.
  // Roles requiring 4+ years are dropped (matches the known band: NOT 4+ yrs).
  maxRequiredYears: 3,
};

// Unambiguous senior/lead title words. Used ONLY as a last resort (no JD text,
// no usable level). \b word-boundaries avoid matching substrings ("leading",
// "headset"). Note: "II"/"2" are intentionally NOT here — mid-level is reachable.
const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|principal|lead|manager|mgr|director|head|architect|vp|vice\s*president|iii|iv|v)\b/i;

// Year-context anchors. A bare "5 years" only counts as a REQUIREMENT when it
// sits near one of these — prevents "founded 5 years ago" from dropping a job.
const EXP_CONTEXT_RE =
  /experien|exp\b|minimum|min\.|at least|relevant|hands?-?on|background|worked|working|proven|track record|of\s+devops|in\s+devops|qualif/i;

/**
 * parseMinYears — smallest experience-requirement (in years) stated in text.
 * Returns null when no experience-anchored year figure is found.
 *
 * Takes the MINIMUM across all matches on purpose: "3-5 years" → 3, so a role
 * stated as a range is judged by its floor (the most candidate-friendly read),
 * which again biases toward KEEPING rather than dropping.
 */
export function parseMinYears(text) {
  if (!text || typeof text !== 'string') return null;
  const hay = text.toLowerCase();
  // grp1 = leading number; grp2 = "+" after it; grp3 = second number (range);
  // grp4 = trailing "+". A figure counts as a requirement when it is a RANGE
  // (two numbers) or carries a "+", OR sits in an experience context — but NEVER
  // when it is immediately followed by "ago" ("founded 5 years ago").
  const re = /(\d{1,2})\s*(\+)?\s*(?:-|–|—|to)?\s*(\d{1,2})?\s*(\+)?\s*(?:years?|yrs?)\b/gi;
  const nums = [];
  let m;
  while ((m = re.exec(hay)) !== null) {
    const after = hay.slice(m.index + m[0].length, m.index + m[0].length + 6);
    if (/^\s*ago/.test(after)) continue; // "5 years ago" is not a requirement

    const isRange = m[3] != null;
    const hasPlus = m[2] != null || m[4] != null;
    const ctxStart = Math.max(0, m.index - 35);
    const ctxEnd = Math.min(hay.length, m.index + m[0].length + 55);
    const hasContext = EXP_CONTEXT_RE.test(hay.slice(ctxStart, ctxEnd));
    if (!isRange && !hasPlus && !hasContext) continue; // bare "5 years" → ambiguous, ignore

    const lead = parseInt(m[1], 10);
    if (Number.isFinite(lead) && lead >= 0 && lead <= 40) nums.push(lead);
  }
  return nums.length ? Math.min(...nums) : null;
}

/**
 * fitsExperience — decide keep/drop for one job.
 * @param {{title?:string, description?:string, jobLevel?:string}} job
 * @returns {{keep:boolean, reason:string, signal:string, minReq:(number|null)}}
 */
export function fitsExperience(job, opts = {}) {
  const { maxRequiredYears } = { ...DEFAULT_FIT, ...opts };
  const title = (job.title || '');
  const level = (job.jobLevel || '').toLowerCase();
  const desc = job.description || '';

  // 1. Stated JD requirement — the truth. Overrides title and level.
  const minReq = parseMinYears(desc) ?? parseMinYears(title);
  if (minReq != null) {
    return {
      keep: minReq <= maxRequiredYears,
      reason: `JD requires ~${minReq}+ yrs`,
      signal: 'jd-years',
      minReq,
    };
  }

  // 2. LinkedIn jobLevel (only the unambiguous ends).
  if (/entry level|associate|internship|intern\b/.test(level))
    return { keep: true, reason: `level: ${job.jobLevel}`, signal: 'level', minReq: null };
  if (/director|executive|vice president|vp\b/.test(level))
    return { keep: false, reason: `level: ${job.jobLevel}`, signal: 'level', minReq: null };

  // 3. Title seniority — last resort, no JD signal available.
  if (SENIOR_TITLE_RE.test(title))
    return { keep: false, reason: 'senior/lead title, no JD years given', signal: 'title', minReq: null };

  // 4. No disqualifying evidence → keep (conservative).
  return { keep: true, reason: 'no disqualifying signal', signal: 'default', minReq: null };
}
