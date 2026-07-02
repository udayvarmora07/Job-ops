/**
 * lib-outreach/fit-post.mjs — score a discovered hiring post against the user's
 * profile (roles + skills + experience), so the scanner only surfaces posts worth
 * acting on.
 *
 * Reuses what already defines "fit" for this user — no new config:
 *   - portals.yml  title_filter.positive / negative  → role keywords + exclusions
 *   - config/profile.yml  target_roles.primary        → target role titles
 *   - cv.md  Skills section                           → the user's skill vocabulary
 *   - uday-data/fit-filter.mjs  fitsExperience()       → years-of-experience gate
 *
 * A post FITS when it matches ≥1 role keyword, hits 0 exclusions, and passes the
 * experience gate. The score (0–100) ranks the fitting posts by relevance.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './keys.mjs';

function readFile(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return ''; }
}

/** Collect `- item` list entries indented under the first line matching `headerRe`. */
function listUnder(raw, headerRe) {
  const lines = raw.split('\n');
  const i = lines.findIndex((l) => headerRe.test(l));
  if (i < 0) return [];
  const baseIndent = (lines[i].match(/^(\s*)/) || ['', ''])[1].length;
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim()) continue;
    const indent = (l.match(/^(\s*)/) || ['', ''])[1].length;
    const m = l.match(/^\s*-\s*"?(.+?)"?\s*$/);
    if (m && indent > baseIndent) out.push(m[1].trim());
    else if (indent <= baseIndent) break;
  }
  return out;
}

/** Single-token skills (Docker, Kubernetes, Terraform, AWS…) from cv.md's Skills section. */
function cvSkillTokens(raw) {
  // Find the heading line that contains "skill" (e.g. "## Technical Skills") and
  // collect lines until the next heading. (Done line-by-line so a multiline regex
  // `$` can't truncate the capture at the first newline.)
  const lines = raw.split('\n');
  const i = lines.findIndex((l) => /^#{1,6}[^\n]*skill/i.test(l));
  if (i < 0) return [];
  const seg = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^#{1,6}\s/.test(lines[j])) break; // next heading → end of section
    seg.push(lines[j]);
  }
  const toks = new Set();
  for (const t of seg.join(' ').split(/[\s,|•·:()\[\]*]+/)) {
    const tok = t.trim().replace(/^[.+/-]+|[.+/-]+$/g, '');
    // Single tokens that look like a tech term — drops category labels with spaces
    // and ≤2-char tokens ("os", "as") that would cause false substring matches.
    if (/^[A-Za-z][A-Za-z0-9.+/#-]{2,19}$/.test(tok)) toks.add(tok.toLowerCase());
  }
  return [...toks];
}

// Experience gate is the user-layer fit-filter; degrade to keep-all if absent.
let _fits = null;
async function getFitsExperience() {
  if (_fits) return _fits;
  try {
    const m = await import('../uday-data/fit-filter.mjs');
    _fits = m.fitsExperience;
  } catch {
    _fits = () => ({ keep: true, reason: 'no experience filter', signal: 'none', minReq: null });
  }
  return _fits;
}

let _profile = null;
/** Load (and cache) the fit profile from the user's config files. */
export function loadFitProfile() {
  if (_profile) return _profile;
  const portals = readFile('portals.yml');
  const profile = readFile('config/profile.yml');
  const cv = readFile('cv.md');

  const positive = listUnder(portals, /^\s*positive:\s*$/).map((s) => s.toLowerCase());
  const negative = listUnder(portals, /^\s*negative:\s*$/).map((s) => s.trim().toLowerCase());
  const roles = listUnder(profile, /^\s*primary:\s*$/).map((s) => s.toLowerCase());

  // Skill vocabulary = role keywords ∪ cv skill tokens (deduped).
  const skills = [...new Set([...positive, ...cvSkillTokens(cv)])];

  _profile = { positive, negative, roles, skills };
  return _profile;
}

// Match a term in lowercased text. Phrases / tokens with non-alphanumerics
// ("site reliability", "ci/cd", "java ") use substring; plain word tokens use a
// word boundary so "aws" never matches inside "always" and "as" can't match "aws".
function has(hay, term) {
  if (/[^a-z0-9]/.test(term)) return hay.includes(term);
  return new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(hay);
}

/**
 * Score one post against the fit profile.
 * @returns {Promise<{fits:boolean, score:number, matched:string[], excluded:string[], reasons:string[], minReq:(number|null)}>}
 */
export async function scorePostFit(post, opts = {}) {
  const prof = loadFitProfile();
  const hay = `${post.role || ''}\n${post.text || ''}`.toLowerCase();
  const reasons = [];

  // 1. Role keyword match (the inclusion signal).
  const roleHits = prof.positive.filter((k) => has(hay, k));
  // 2. Exclusions (Java/iOS/Junior/Intern/…).
  const excluded = prof.negative.filter((k) => has(hay, k));
  // 3. Skill overlap (ranking signal).
  const matched = prof.skills.filter((k) => has(hay, k));

  // 4. Experience gate (years stated in the post text vs the user's band).
  const fitsExperience = await getFitsExperience();
  const exp = fitsExperience({ title: post.role || '', description: post.text || '' });

  let fits = roleHits.length > 0 && excluded.length === 0 && exp.keep;
  if (roleHits.length === 0) reasons.push('no target-role keyword');
  if (excluded.length > 0) reasons.push(`excluded: ${excluded.join(', ')}`);
  if (!exp.keep) reasons.push(exp.reason);
  if (fits) reasons.push(`role: ${roleHits.slice(0, 3).join(', ')}`);

  // Score: role match dominates, skill overlap refines. Capped at 100.
  const score = fits
    ? Math.min(100, roleHits.length * 30 + matched.length * 8 + (exp.minReq != null ? 10 : 0))
    : 0;

  return { fits, score, matched, excluded, reasons, minReq: exp.minReq ?? null };
}
