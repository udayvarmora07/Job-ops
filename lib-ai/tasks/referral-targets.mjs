/**
 * lib-ai/tasks/referral-targets.mjs — "who should I ask for a referral?"
 *
 * Given a target company + role, reason like a real human networker over the
 * candidate's ACTUAL background (former employers/colleagues, college/university
 * alumni, same city/region, shared communities, plus hiring manager & team
 * peers) and return the 3 best referral paths — each with who to look for, why
 * it's a warm path, LinkedIn search keywords, and a ready-to-send message.
 *
 * Ethics: never invent real named individuals. Describe WHO to find + give the
 * exact search so the candidate finds the real person themselves.
 *
 * Routed to GLM 5.1 (structured output) by config/ai.yml.
 */

import { z } from 'zod';
import { candidateContext } from '../context.mjs';

export const referralTargetsSchema = z.object({
  strategy: z
    .string()
    .describe('1–2 sentences: the overall referral strategy for this role/company given the candidate background.'),
  targets: z
    .array(
      z.object({
        rank: z.number().int().describe('1 = best path'),
        persona: z
          .string()
          .describe('Short label, e.g. "Ex-colleague (eSparkBiz)", "College alumnus", "Hiring manager", "Peer SRE on the team", "Second-degree via mutual".'),
        who: z
          .string()
          .describe('Concretely WHO to look for at the company — never a fabricated name. Describe the person profile to search for.'),
        why: z
          .string()
          .describe("Why this path is warm/effective, citing a REAL fact from the candidate's CV/profile (employer, college, city, skill)."),
        warmth: z.enum(['high', 'medium', 'low']),
        linkedinKeywords: z
          .string()
          .describe('Keywords to paste into LinkedIn people search to find this person (e.g. company + affiliation + title).'),
        outreachMessage: z
          .string()
          .describe('A ready-to-send LinkedIn DM, <= 90 words, personalized to this persona. Use [their name] as a placeholder.'),
      })
    )
    .length(3)
    .describe('Exactly 3 referral targets, ranked best-first.'),
});

export function buildReferralTargets({ company, role, jd } = {}) {
  if (!company || !String(company).trim()) {
    throw new Error('buildReferralTargets: company is required.');
  }

  const system = `You are a referral strategist for jobops. Your job: find the candidate the
3 BEST people to ask for a referral for a specific role at a specific company.

Think like a real, experienced human networker — prioritize WARM paths grounded in
the candidate's ACTUAL background, in this rough order:
  1. Former employers/colleagues who now (or might) work at the target company.
  2. College/university alumni now at the target company.
  3. Same city / region / country overlap, or shared communities (meetups, OSS, certs).
  4. The hiring manager / team lead for this role.
  5. Peer engineers already on the team (they reply most and vouch on fit).
Weigh each path's warmth, influence on the decision, and likelihood of a reply.

HARD RULES:
- NEVER invent real named individuals. Describe WHO to look for and give exact
  LinkedIn search keywords so the candidate finds the real person themselves.
- Every "why" must cite a REAL fact from the candidate's CV/profile below
  (a specific employer, college, city, or skill) — no generic filler.
- Pick the 3 strongest DISTINCT paths for THIS company + role (not 3 of the same kind
  unless that truly is best). Rank them best-first.

${candidateContext()}`;

  const prompt = `TARGET COMPANY: ${String(company).trim()}
TARGET ROLE: ${role ? String(role).trim() : '(unspecified)'}${
    jd ? `\n\nJOB DESCRIPTION:\n${String(jd).trim()}` : ''
  }

Return the 3 best referral targets for this role, ranked.

Output ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{
  "strategy": "1-2 sentence overall strategy",
  "targets": [
    {
      "rank": 1,
      "persona": "short label",
      "who": "who to look for (no fabricated names)",
      "why": "why, citing a real fact from the CV",
      "warmth": "high|medium|low",
      "linkedinKeywords": "keywords for LinkedIn people search",
      "outreachMessage": "<=90 word DM using [their name]"
    }
    // exactly 3 items
  ]
}`;

  return { system, prompt };
}

/**
 * Tolerant parse of the model's JSON output (handles code fences / stray prose).
 * Returns a validated object, or throws if it can't be recovered.
 */
export function parseReferralTargets(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);

  const obj = JSON.parse(t);
  const parsed = referralTargetsSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  // Be lenient: accept any object that has a non-empty targets array.
  if (obj && Array.isArray(obj.targets) && obj.targets.length) return obj;
  throw new Error('Model output did not contain a valid targets array.');
}
