/**
 * lib-ai/context.mjs — shared helpers for task prompt-builders.
 *
 * One place to read user-layer files (cv.md, modes/*, profile) and stamp the
 * current date, so every task builder stays small and consistent.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ROOT } from './config.mjs';

/** Read a repo-relative file, or a friendly placeholder if it's missing. */
export function read(rel, label = rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return `[${label} not found — skipping]`;
  return readFileSync(p, 'utf-8').trim();
}

/** Today as YYYY-MM-DD (local), for dating reports/letters correctly. */
export function today() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** Candidate contact details. Prefer the provided user context; fall back to config/profile.yml. */
export function candidateContact(userContext = null) {
  if (userContext) {
    const name = userContext.fullName || '';
    const linkedin = userContext.linkedinUrl || '';
    return {
      name,
      email: userContext.email || '',
      phone: userContext.phone || '',
      linkedin,
      linkedinUrl: linkedin ? (/^https?:\/\//.test(linkedin) ? linkedin : `https://${linkedin}`) : '',
      github: userContext.githubUrl || '',
      location: [userContext.city, userContext.country].filter(Boolean).join(', ') || '',
      availability: userContext.availability || '',
    };
  }
  const raw = read('config/profile.yml');
  const get = (k) =>
    (raw.match(new RegExp(`^\\s*${k}:\\s*"?([^"\\n]+?)"?\\s*$`, 'm')) || [])[1]?.trim() || '';
  const rawName = get('full_name');
  // Title-case an ALL-CAPS name so the signature reads naturally ("UDAY" → "Uday").
  const name = rawName
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
  const linkedin = get('linkedin');
  return {
    name: name || rawName,
    email: get('email'),
    phone: get('phone'),
    linkedin,
    linkedinUrl: linkedin ? (/^https?:\/\//.test(linkedin) ? linkedin : `https://${linkedin}`) : '',
    github: get('github'),
    location: get('location'),
    availability: get('availability'),
  };
}

/** A clean email signature block (name + phone + LinkedIn URL + email). */
export function candidateSignature(userContext = null) {
  const c = candidateContact(userContext);
  const line2 = [c.phone, c.linkedinUrl, c.email].filter(Boolean).join('  |  ');
  return [c.name, line2].filter(Boolean).join('\n');
}

/** Common candidate context block reused across tasks. */
export function candidateContext(userContext = null) {
  const cvMarkdown = userContext?.cvMarkdown || read('cv.md');
  const profileText = userContext
    ? JSON.stringify(userContext, null, 2)
    : read('config/profile.yml');
  const archetypes = userContext?.archetypes
    ? JSON.stringify(userContext.archetypes, null, 2)
    : read('modes/_profile.md');

  return `════════════════════════════════════════════════════════════
CANDIDATE RESUME
════════════════════════════════════════════════════════════
${cvMarkdown}

════════════════════════════════════════════════════════════
CANDIDATE PROFILE & TARGETS
════════════════════════════════════════════════════════════
${profileText}

════════════════════════════════════════════════════════════
USER ARCHETYPES & NARRATIVE
════════════════════════════════════════════════════════════
${archetypes}`;
}

/** Standard CLI operating rules (no web/files/browser tools in a pipe). */
export const CLI_RULES = `You are running in a CLI session: no WebSearch, Playwright, or file-writing tools.
- Base any external facts (salaries, company info) on training data and label them as estimates.
- Do not claim to have visited URLs or verified live pages.
- Output the final deliverable directly as text.`;
