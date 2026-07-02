/**
 * lib-outreach/permute.mjs — name parsing + email pattern permutation (Layer 0).
 *
 * Pure, free, no network. Given a name + domain, generate the likely email
 * addresses ranked by the documented likelihood of each corporate pattern. Also
 * applies a *known* pattern (e.g. from Hunter's domain-search) to a name.
 */

/** "John Q. Doe" -> { first:"john", last:"doe" }. ASCII-folded, punctuation stripped. */
export function parseName(full) {
  const parts = String(full || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .trim().split(/\s+/).filter(Boolean);
  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!parts.length) return { first: '', last: '' };
  return {
    first: clean(parts[0]),
    last: parts.length > 1 ? clean(parts[parts.length - 1]) : '',
  };
}

// Ordered by likelihood (guide §4.1). {first}{last}{f}{l} = Hunter's token syntax.
const PATTERNS = [
  ['{first}.{last}', 0.95],
  ['{f}{last}', 0.9],
  ['{first}{last}', 0.7],
  ['{first}', 0.6],
  ['{first}_{last}', 0.45],
  ['{first}-{last}', 0.4],
  ['{last}', 0.3],
  ['{last}.{first}', 0.25],
  ['{first}{l}', 0.2],
  ['{f}.{last}', 0.2],
  ['{f}{l}', 0.15],
];

/** Apply a Hunter-style pattern string to a name. Returns null if unresolved. */
export function applyPattern(pattern, first, last, domain) {
  const f = first?.[0] || '';
  const l = last?.[0] || '';
  const local = String(pattern || '')
    .replace(/\{first\}/g, first || '')
    .replace(/\{last\}/g, last || '')
    .replace(/\{f\}/g, f)
    .replace(/\{l\}/g, l)
    .replace(/\{fi\}/g, f)
    .replace(/\{li\}/g, l);
  if (!local || /[{}]/.test(local)) return null;
  return `${local}@${domain}`.toLowerCase();
}

/** All plausible permutations for a name+domain, ranked (highest likelihood first). */
export function permutations(first, last, domain) {
  const out = [];
  const seen = new Set();
  for (const [pat, likelihood] of PATTERNS) {
    // patterns needing a last name are skipped when we only have a first name
    if (/\{last\}|\{l\}|\{li\}/.test(pat) && !last) continue;
    const email = applyPattern(pat, first, last, domain);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, pattern: pat, likelihood, source: 'permutation' });
  }
  return out;
}
