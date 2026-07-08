/**
 * lib-ai/tasks/evaluate-job.mjs — assembles the A–G job-evaluation prompt.
 *
 * Reuses the user's own logic files (modes/_shared.md, modes/oferta.md) plus
 * cv.md, config/profile.yml, and modes/_profile.md. Returns { system, prompt }
 * for runTask('evaluate_job', ...). Model selection lives in config/ai.yml.
 */

import { read, today, candidateContext } from '../context.mjs';

/** Build the { system, prompt } pair for an evaluation of `jdText`. */
/**
 * @param {string} jdText
 * @param {object|null} userContext  optional per-user profile/CV context
 */
export function buildEvaluateJob(jdText, userContext = null) {
  if (!jdText || !String(jdText).trim()) {
    throw new Error('buildEvaluateJob: empty job description.');
  }

  const system = `You are jobops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.
Today's date is ${today()} — use it for any report date; never guess the date.

Your evaluation methodology is defined below. Follow it exactly.

════════════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
════════════════════════════════════════════════════════════
${read('modes/_shared.md')}

════════════════════════════════════════════════════════════
EVALUATION MODE (oferta.md)
════════════════════════════════════════════════════════════
${read('modes/oferta.md')}

${candidateContext(userContext)}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS CLI SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. Generate Blocks A through G in full, in English, unless the JD is in another language.
3. Use ${today()} as the report date.
4. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;

  const prompt = `JOB DESCRIPTION TO EVALUATE:\n\n${String(jdText).trim()}`;
  return { system, prompt };
}
