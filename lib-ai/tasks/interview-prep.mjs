/**
 * lib-ai/tasks/interview-prep.mjs — generate a company/role interview prep guide.
 *
 * Uses modes/interview-prep.md + the running story bank + candidate context.
 * Routed to DeepSeek V4 Pro (reasoning) by config/ai.yml.
 */

import { read, today, candidateContext, CLI_RULES } from '../context.mjs';

export function buildInterviewPrep(brief) {
  if (!brief || !String(brief).trim()) {
    throw new Error('buildInterviewPrep: empty brief (provide company/role/JD).');
  }

  const system = `You produce focused interview-prep guides for career-ops. Today is ${today()}.

Follow the methodology below. Ground every STAR+R story in the candidate's real CV;
never invent achievements. Be specific to the company/role in the brief.

${CLI_RULES}

═══════════════════════════════════════════════════════
INTERVIEW-PREP METHODOLOGY (interview-prep.md)
═══════════════════════════════════════════════════════
${read('modes/interview-prep.md')}

═══════════════════════════════════════════════════════
EXISTING STORY BANK (interview-prep/story-bank.md, optional)
═══════════════════════════════════════════════════════
${read('interview-prep/story-bank.md')}

${candidateContext()}

OUTPUT: likely question themes, 4–6 STAR+R stories mapped to the role, smart
questions to ask, and red-flag-question handling.`;

  const prompt = `INTERVIEW BRIEF (company / role / JD / stage):\n\n${String(brief).trim()}`;
  return { system, prompt };
}
