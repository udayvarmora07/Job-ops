/**
 * lib-ai/tasks/connection-notes.mjs
 *
 * Generate two LinkedIn connection notes (≤200 chars each — LinkedIn's hard limit)
 * plus a follow-up referral message for the two-step path.
 */

import { candidateContext } from '../context.mjs';

/**
 * @param {{ company: string, role: string, persona: string, why?: string }} opts
 */
export function buildConnectionNotes({ company, role, persona, why } = {}) {
  const system = `You write ultra-short LinkedIn connection notes for Uday Varmora's job search.

LinkedIn connection notes have a HARD 200-character limit. Every character counts.
Be specific, human, and genuine — no corporate fluff, no emoji spam.

${candidateContext()}`;

  const prompt = `TARGET COMPANY: ${company}
TARGET ROLE: ${role || 'unspecified'}
PERSONA TO REACH: ${persona}${why ? `\nWHY THIS PATH: ${why}` : ''}

Generate EXACTLY this JSON (no prose, no markdown fences):

{
  "directAsk": "...",
  "warmIntro": "...",
  "referralFollowUp": "..."
}

Rules:
- "directAsk": ≤200 chars. Connection note that includes a soft referral ask. Mention the role briefly. Use [Name] placeholder. Must count characters strictly.
- "warmIntro": ≤200 chars. Connection note with NO referral ask — just a genuine intro. Sets up a two-step conversation. Use [Name] placeholder.
- "referralFollowUp": ≤120 words. The follow-up DM sent AFTER they accept the connection. Now you can ask for the referral properly. Reference that they just connected. Use [Name] placeholder.

Character counts matter — do NOT exceed 200 for the connection notes.`;

  return { system, prompt };
}
