/**
 * lib-ai/tasks/draft-referral.mjs — draft LinkedIn outreach / referral messages.
 *
 * Uses modes/contacto.md (the outreach framework) + candidate context. Routed to
 * MiniMax M3 (fast/cheap, agentic) by config/ai.yml.
 */

import { read, candidateContext, CLI_RULES } from '../context.mjs';

export function buildDraftReferral(brief) {
  if (!brief || !String(brief).trim()) {
    throw new Error('buildDraftReferral: empty brief (provide JD/company/role/contact type).');
  }

  const system = `You draft short, high-signal LinkedIn outreach messages for jobops.

Follow the outreach framework below. Messages must be concise (LinkedIn-length),
specific to the role/company, and honest. Produce TWO variants:
  1. "insight-first" — ask for a brief chat / insight, low-pressure.
  2. "referral-ask" — directly but politely ask for a referral.
Keep each under ~90 words. No flattery padding.

${CLI_RULES}

═══════════════════════════════════════════════════════
OUTREACH FRAMEWORK (contacto.md)
═══════════════════════════════════════════════════════
${read('modes/contacto.md')}

${candidateContext()}`;

  const prompt = `OUTREACH BRIEF (role / company / contact type / any context):\n\n${String(brief).trim()}`;
  return { system, prompt };
}
