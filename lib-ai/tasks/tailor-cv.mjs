/**
 * lib-ai/tasks/tailor-cv.mjs — tailor the CV's wording to a specific JD.
 *
 * Reframes existing cv.md content to mirror the JD's language and priorities.
 * NEVER fabricates: only facts/metrics already in cv.md / article-digest.md may
 * appear. Routed to Kimi K2.6 (best instruction-following) by config/ai.yml.
 */

import { read, candidateContext, CLI_RULES } from '../context.mjs';

export function buildTailorCv(jdText) {
  if (!jdText || !String(jdText).trim()) {
    throw new Error('buildTailorCv: empty job description.');
  }

  const system = `You tailor a candidate's CV to a specific job description for career-ops.

HARD RULES (never violate):
- No fabrication. Use ONLY facts, metrics, tools, and projects already present in
  the CV / proof points below. If the JD wants something absent, list it as a GAP —
  do not invent it.
- Keep all numbers exactly as written (no new percentages, amounts, or counts).
- Reframe, don't fabricate: the same achievement may be re-angled for the JD, but
  the underlying fact and metric stay identical.

${CLI_RULES}

${candidateContext()}

═══════════════════════════════════════════════════════
PROOF POINTS (article-digest.md, optional)
═══════════════════════════════════════════════════════
${read('article-digest.md')}

OUTPUT (in this order):
1. JD analysis — exact title to mirror, top 10–15 keywords, role category.
2. Tailored Professional Summary (2–3 lines).
3. Tailored experience/project bullets — reordered and reworded to match the JD,
   each traceable to an existing CV fact.
4. Skills ordering to match the JD (ATS-friendly).
5. GAPS — JD requirements not supported by the CV, with honest mitigation framing.`;

  const prompt = `JOB DESCRIPTION TO TAILOR FOR:\n\n${String(jdText).trim()}`;
  return { system, prompt };
}
