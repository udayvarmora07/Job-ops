/**
 * lib-outreach/templates.mjs — the 5 cold-mail templates + A/B rotation/stats.
 *
 * Each template is a research-backed COLD-EMAIL ARCHETYPE (see
 * email-finder-roadmap/COLD_MAIL_TEMPLATES.md for the why). The `structure`
 * string is injected verbatim into the cold_email task prompt
 * (lib-ai/tasks/cold-email.mjs) so the model writes in that template's shape
 * while still obeying the non-negotiable deliverability rules.
 *
 * A/B testing is the whole point: nextTemplate() round-robins the LEAST-USED
 * template across past outreach so usage stays balanced, and templateStats()
 * reports reply-rate per template from the outreach store's status field
 * (replied / no_response / bounced are already tracked). This module is PURE:
 * it never reads the store itself — callers pass the records array in — so there
 * is no circular dependency with store.mjs.
 */

/**
 * The 5 templates. Tuned for the India job market + remote roles. Order here is
 * the canonical A/B order; ids are stable and stored on each outreach record.
 */
export const TEMPLATES = [
  {
    id: 'direct-match',
    name: 'Direct Role-Match',
    technique: 'Classic direct application — clarity over cleverness',
    bestFor: 'In-house recruiters / TA who posted a specific role with a clear JD',
    structure: `BODY SHAPE — DIRECT ROLE-MATCH (the SUBJECT is chosen separately by the strategy rules above):
- Sentence 1: who you are + that you're applying for THIS exact role (name it).
- Sentence 2–3: the two matched skills/metrics from the candidate context that map most directly to the JD's must-haves.
- Sentence 4: one line of genuine role/company fit (not generic flattery).
- CTA: "I've attached my résumé for the {role} role — happy to share more or do a quick call."
Plain, scannable, zero gimmicks — the safe baseline.`,
    indiaNotes: 'Indian corporate recruiters expect a clear role-match + the CV attached. State current location and notice period in the fit line.',
    remoteNotes: 'Name the role exactly; add one line that you work well async / have timezone overlap.',
  },
  {
    id: 'proof-first',
    name: 'Proof-First (AIDA)',
    technique: 'AIDA — lead with a quantified result as the attention hook',
    bestFor: 'Engineering managers and founders who respond to impact',
    structure: `BODY SHAPE — PROOF-FIRST / AIDA (the SUBJECT is chosen separately by the strategy rules above):
- Sentence 1 (Attention): open with your single strongest quantified result from the candidate context.
- Sentence 2 (Interest): a second metric + the matched skills/scale it ran at, tied to what the JD needs.
- Sentence 3 (Desire): connect that track record to this specific role/team.
- Sentence 4 (Action): "Résumé attached — open to a quick 15-min chat about the {role} role?"
Let the numbers carry it; keep adjectives out.`,
    indiaNotes: 'Numbers travel well with Indian hiring managers; still open with a respectful greeting, not just the metric.',
    remoteNotes: 'Results are location-independent — make that implicit by leading with outcomes, not where you sit.',
  },
  {
    id: 'problem-solution',
    name: 'Problem-Solution (PAS)',
    technique: 'Problem → Agitate → Solve — name the pain the role implies',
    bestFor: 'Startup founders / CTOs, small teams, and speculative outreach',
    structure: `BODY SHAPE — PROBLEM-SOLUTION / PAS (the SUBJECT is chosen separately by the strategy rules above):
- Sentence 1 (Problem): name the likely pain the role implies (CI reliability, cloud cost, scaling, on-call toil) — inferred from the JD, never presumptuous.
- Sentence 2 (Agitate): one short line on why that pain compounds as the team grows.
- Sentence 3 (Solve): the matched skill/metric that proves you've solved exactly that before.
- Sentence 4 (CTA): "Résumé attached — would a 15-min call on how I'd approach this be useful?"
Confident, not arrogant — offering to help, not lecturing.`,
    indiaNotes: 'Works for Indian startups; keep the "problem" framing humble — position as eager to contribute, not critical of their setup.',
    remoteNotes: 'Great for remote-first startups — stress autonomy and that you can own the problem end-to-end.',
  },
  {
    id: 'warm-hook',
    name: 'Warm-Hook (Personalised)',
    technique: 'Personalisation-led — open with a genuine, specific hook',
    bestFor: 'Any recipient when a real hook exists (the post itself, shared tool, company news)',
    structure: `BODY SHAPE — WARM-HOOK (the SUBJECT is chosen separately by the strategy rules above):
- Sentence 1 (Hook): reference the actual hiring post / a shared tool / a recent company milestone — something concrete that proves this isn't a blast.
- Sentence 2: who you are + that the role lines up with what you do (lead with the matched skills).
- Sentence 3: one anchor metric most relevant to the JD.
- Sentence 4 (CTA): "I've attached my résumé — is this the right place to send it, or is there a better contact?"
The hook MUST be real (use the post text). If there is no genuine hook, do not fabricate one — fall back to a direct opener.`,
    indiaNotes: 'Relationship-first framing fits Indian norms; a warm, respectful opener referencing their post lands well.',
    remoteNotes: 'Reference the "remote" detail in the post explicitly so it is clear you read it.',
  },
  {
    id: 'soft-ask',
    name: 'Soft-Ask (Short & Polite)',
    technique: 'Permission / low-pressure question — ultra-short, mobile-readable',
    bestFor: 'Busy recruiters; agency recruiters; high-volume posts',
    structure: `BODY SHAPE — SOFT-ASK (the SUBJECT is chosen separately by the strategy rules above; keep the body ultra short):
- Keep the body to ~3 short sentences:
  1. Polite greeting + that you saw they're hiring for {role}.
  2. Who you are + your single most relevant matched skill/credential (mention you can join immediately).
  3. A low-pressure question CTA: "Is this the right address to send my CV for the {role} role? Happy to share it."
No hard sell — the easiest possible "yes" for a busy reader; reads cleanly on a phone.`,
    indiaNotes: 'Matches Indian formality + recruiters who screen on mobile; courteous, brief, asks permission.',
    remoteNotes: 'Brevity reads well across timezones; one short line that you are set up for remote work is enough.',
  },
];

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
const DEFAULT_ID = TEMPLATES[0].id;

/** Look up a template by id; null if unknown. */
export function getTemplate(id) {
  if (!id) return null;
  return TEMPLATES.find((t) => t.id === id) || null;
}

/**
 * A/B rotation — pick the LEAST-USED template across past outreach so usage
 * stays balanced (cleaner reply-rate data than random). Ties break by canonical
 * order. `records` is the outreach list (each may carry a `templateId`).
 */
export function nextTemplate(records = []) {
  const counts = Object.fromEntries(TEMPLATE_IDS.map((id) => [id, 0]));
  for (const r of records) {
    if (r && r.templateId && counts[r.templateId] !== undefined) counts[r.templateId]++;
  }
  let bestId = DEFAULT_ID;
  let bestCount = Infinity;
  for (const id of TEMPLATE_IDS) {
    if (counts[id] < bestCount) { bestCount = counts[id]; bestId = id; }
  }
  return getTemplate(bestId);
}

/**
 * A/B stats — per template: how many were drafted/sent/replied/etc. and the
 * reply-rate among SENT mails (sent is the denominator; drafted-but-unsent
 * shouldn't penalise a template). `records` is the outreach list.
 */
export function templateStats(records = []) {
  const base = () => ({
    templateId: '', name: '',
    drafted: 0, sent: 0, replied: 0, bounced: 0, no_response: 0, closed: 0,
    total: 0, replyRate: 0,
  });
  const byId = {};
  for (const t of TEMPLATES) {
    byId[t.id] = { ...base(), templateId: t.id, name: t.name };
  }
  for (const r of records) {
    const id = r && r.templateId;
    if (!id || !byId[id]) continue;
    const row = byId[id];
    row.total++;
    if (row[r.status] !== undefined) row[r.status]++;
  }
  for (const id of TEMPLATE_IDS) {
    const row = byId[id];
    // "sent" in the store is the live/awaiting bucket; replied/no_response/bounced
    // are terminal outcomes of a sent mail. Denominator = everything that went out.
    const wentOut = row.sent + row.replied + row.no_response + row.bounced;
    row.replyRate = wentOut > 0 ? Math.round((row.replied / wentOut) * 100) : 0;
  }
  return TEMPLATE_IDS.map((id) => byId[id]);
}
