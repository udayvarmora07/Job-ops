/**
 * lib-ai/tasks/tailor-cv-json.mjs — tailor the CV for a JD, output resume-system JSON.
 *
 * Unlike tailor-cv.mjs (which streams a markdown analysis), this task outputs a
 * pure JSON content file ready for uday-data/resume-system/build.js.
 * Called by /api/generate-cv-pdf for the "Download CV PDF" feature.
 */

import { read, CLI_RULES } from '../context.mjs';

/**
 * @param {string} jdText
 * @param {string} [instructions]
 * @param {Record<string, unknown> | null} [baseContent]  latest version's content, for update mode
 * @param {object|null} [userContext]  per-user profile/CV context
 */
export function buildTailorCvJson(jdText, instructions = '', baseContent = null, userContext = null) {
  if (!jdText || !String(jdText).trim()) {
    throw new Error('buildTailorCvJson: empty job description.');
  }
  const isUpdate = baseContent && typeof baseContent === 'object';

  const template = read('uday-data/resume-system/content/universal.json', 'universal.json template');
  const masterBrief = userContext?.cvMarkdown || read('uday-data/01_MASTER_BRIEF.md', 'master brief');
  const articleDigest = read('article-digest.md');

  const system = `You generate a tailored resume content JSON file for a specific job description.

OUTPUT RULES (follow exactly — they are enforced by code):
1. Return ONLY valid JSON. No markdown, no explanation, no code fences.
2. The JSON object must have exactly these top-level keys (in any order):
   filenameSuffix, title, colorScheme, summary, skills, experience, projects, education, achievements
3. The JSON SHAPE must match the template exactly:
   - "skills" = array of ["Category", "comma, separated, items"] string pairs (keep 8 rows).
   - "experience" = array of { role, org, dates, bullets:[...] } (2 jobs: full-time then intern;
     keep 5 bullets on the full-time job, 2 on the intern — same as the template).
   - "projects" = array of { title, tech, bullets:[...] } (keep all 3 projects).
   - "education" = { left, right }; "achievements" = array of strings.
4. NEVER fabricate. Use ONLY facts, metrics, tools, and projects present in the MASTER BRIEF
   and template below. Anything the JD asks for that is absent is a GAP — leave it out, never
   invent it. Items in the brief's "NEVER CLAIM" list must NEVER appear, even if the JD demands
   them (e.g. error-budget policy/governance, Go, GCP, chaos engineering, OpenTelemetry/Jaeger).
5. Keep every number exactly as written in the brief's Anchor Metrics. EKS upgrade is v1.33 → v1.34.
   Experience is "1+ year". Never add new percentages, amounts, or counts. Reframe — never invent.
6. Use **bold** syntax inside strings (same **text** convention as the template).
7. Keep each skills row value string under ~115 characters; keep each project tech line under ~115.
8. filenameSuffix: ALWAYS set to "Studio_Tailored" (required — the build script uses it).
9. colorScheme: "navy" for enterprise/corporate/BFSI roles, "teal" for startups/scale-ups.
10. summary: 2–3 sentences; mirror the JD's EXACT title and top keywords; ATS-optimised.
${isUpdate ? `
UPDATE MODE (IMPORTANT): A "CURRENT RESUME JSON" is provided in the user message — it is the
candidate's LATEST saved version. Treat it as the STARTING POINT, not a blank slate:
- ALWAYS re-align the resume to the JOB DESCRIPTION above, even with no explicit instruction:
  this resume is FOR that JD. Re-check the "TAILORING METHOD" steps A–E against the current JD.
  In particular, apply step D — pull in EVERY Tier-2 tool the JD explicitly names (e.g. if the
  JD lists Datadog, ELK, OpenShift, SonarQube, etc., add them to the matching skills row and,
  where natural, the relevant bullet) and reorder skills so JD-relevant categories lead. Never
  drop a JD-required, brief-supported tool just because the previous version omitted it.
- PRESERVE prior wording refinements, custom phrasing, and choices that the JD does NOT touch;
  do not undo earlier edits or regenerate unrelated sections from scratch.
- Also apply any SPECIFIC UPDATE INSTRUCTIONS on top of the JD re-alignment.
- Output the FULL updated JSON in the exact same shape (every key, same structure).
` : ''}
TAILORING METHOD (this is what makes the resume role-specific, not generic):
A. Detect the role category from the JD — pick ONE: DevOps / SRE / Cloud Engineer / Platform
   Engineer / BFSI-Enterprise / Startup. Set "title" to mirror the JD's exact title.
B. SELECT the best-fit bullets from the brief's "Experience Bullet Library" (B1–B10) for that
   category — do NOT just reuse the template's DevOps bullets. In particular:
   - SRE → lead with B9 (production reliability / 99.9% uptime SLA / SLO monitoring) and B10
     (incident response / blameless post-mortems / runbooks), then B4, B5.
   - Cloud Engineer → lead with B7 (AWS architecture breadth) and B8 (cost optimization), then B2.
   - Platform Engineer → frame around internal platform, golden paths, self-service (B1, B3, B5).
   - DevOps → B1, B2, B3 (pipelines / IaC / K8s) as the template already does.
   - BFSI/Enterprise → emphasise B6 (security/least-privilege) and governance framing.
   Keep the two intern bullets (I1, I2) as the second job.
C. REFRAME verbs/emphasis to match the brief's "Tone Reframing by Role Type" table for that
   category (e.g. SRE: Sustained/Drove/Authored/Eliminated; Cloud: Architected/Operated). The
   underlying fact and metric stay identical — only the angle changes.
D. REORDER skills rows so the JD-relevant categories come first. Pull Tier-2 items into the
   skills/bullets ONLY if the JD explicitly asks for them; otherwise prefer Tier-1.
E. REORDER project bullets so the most JD-relevant lead.

${CLI_RULES}

═══════════════════════════════════════════════════════
MASTER BRIEF — the authoritative source of facts, the bullet library (B1–B10),
the tone-reframing table, the tech tiers, and the NEVER-CLAIM list. Draw all
wording from here; the template below only fixes the JSON SHAPE and identity.
═══════════════════════════════════════════════════════
${masterBrief}

═══════════════════════════════════════════════════════
TEMPLATE (universal.json — defines the exact JSON SHAPE, fixed identity, dates,
and education; use the brief above to choose/reframe the actual wording):
═══════════════════════════════════════════════════════
${template}

PROOF POINTS (article-digest.md, optional extra evidence):
${articleDigest}`;

  const instructionBlock = instructions && String(instructions).trim()
    ? `\n\nSPECIFIC UPDATE INSTRUCTIONS (apply these on top of the standard tailoring rules):\n${String(instructions).trim()}`
    : '';

  const baseBlock = isUpdate
    ? `\n\nCURRENT RESUME JSON (the latest saved version — UPDATE THIS, preserve everything not explicitly changed):\n${JSON.stringify(baseContent, null, 2)}`
    : '';

  const prompt = `JOB DESCRIPTION TO TAILOR FOR:

${String(jdText).trim()}${baseBlock}${instructionBlock}

Return ONLY valid JSON — no code fences, no explanation, no prose before or after.`;

  return { system, prompt };
}
