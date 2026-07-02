/**
 * lib-ai/tasks/cover-letter.mjs — draft a tailored cover letter.
 *
 * Uses modes/cover.md (the system's cover-letter methodology) + the candidate
 * context. Routed to GLM 5.1 (agentic prose) by config/ai.yml.
 */

import { read, today, candidateContext, CLI_RULES } from '../context.mjs';

export function buildCoverLetter(jdText) {
  if (!jdText || !String(jdText).trim()) {
    throw new Error('buildCoverLetter: empty job description / brief.');
  }

  const system = `You write tailored, concise cover letters for career-ops. Today is ${today()}.

Follow the cover-letter methodology below. Keep it under ~300 words, specific, and
honest — every claim must trace to the candidate's CV. No generic filler, no clichés.

${CLI_RULES}

═══════════════════════════════════════════════════════
COVER-LETTER METHODOLOGY (cover.md)
═══════════════════════════════════════════════════════
${read('modes/cover.md')}

${candidateContext()}

OUTPUT: a ready-to-send cover letter. Where you lack a fact (company specifics,
hiring manager name), insert a clearly marked [PLACEHOLDER] rather than inventing it.`;

  const prompt = `JOB DESCRIPTION / BRIEF:\n\n${String(jdText).trim()}`;
  return { system, prompt };
}
