/**
 * lib-ai/tasks/resume-qa.mjs — review a generated resume from every angle.
 *
 * Runs automatically after each resume generation. Thinks like a careful human
 * reviewer AND a machine (ATS): spelling, grammar, consistency, completeness,
 * truthfulness (no fabricated metrics — the #1 risk with AI-tailored CVs), JD/ATS
 * keyword alignment, impact, formatting, and red flags. Outputs strict JSON.
 */

import { read, candidateContext, CLI_RULES } from '../context.mjs';
import { extractJson } from '../json.mjs';

const PERSPECTIVES = `1. SPELLING & TYPOS — any misspelled word, doubled word, or typo.
2. GRAMMAR & PUNCTUATION — agreement, articles, comma/period consistency on bullets.
3. CONSISTENCY — verb tense (past for past roles, present for current), date formats,
   capitalization, terminology (e.g. "Kubernetes" vs "k8s"), bullet punctuation, spacing.
4. COMPLETENESS — contact info (name, email, phone, location, LinkedIn/GitHub), summary,
   skills, every experience entry with title+company+dates, education. Flag empty/missing.
5. TRUTHFULNESS (CRITICAL) — flag ANY metric, number, technology, employer, title, or claim
   NOT supported by the candidate's real facts below. AI tailoring can hallucinate — catch it.
6. JD & ATS ALIGNMENT — does it surface what THIS job asks for? List high-value JD keywords
   that are missing or under-emphasised. Note any ATS-unfriendly formatting.
7. IMPACT — bullets lead with strong action verbs and quantified outcomes, not duties/fluff.
8. FORMATTING & LENGTH — one-page fit, parallel structure, bullet length, no orphan/odd chars.
9. RED FLAGS — placeholder text ([company], TODO, lorem, "XYZ"), duplicate bullets, first-person
   pronouns, inconsistent number formatting, keyword stuffing.`;

export function buildResumeQa(input = {}) {
  const { resume, jd } = typeof input === 'string' ? { resume: input, jd: '' } : input;
  const resumeText =
    typeof resume === 'string' ? resume : JSON.stringify(resume ?? {}, null, 2);
  const masterBrief = read('uday-data/01_MASTER_BRIEF.md', 'MASTER_BRIEF');

  const system = `You are a meticulous senior resume reviewer, professional copy-editor, and
ATS specialist rolled into one. Review the generated resume from EVERY perspective below and
report concrete, specific findings — not vague advice. Quote the exact offending text in "where".

PERSPECTIVES TO CHECK:
${PERSPECTIVES}

Be honest and exacting, but do NOT invent problems: if a perspective is clean, say so via
"perspectivesChecked" and add no issues for it. Severity: "high" = factually wrong / broken /
embarrassing (typo, fabricated metric, missing contact); "medium" = weakens the resume
(missing JD keyword, weak bullet); "low" = polish.

OUTPUT STRICT JSON ONLY — no prose, no markdown fences:
{
  "verdict": "pass" | "minor_issues" | "needs_fixes",
  "score": <integer 0-100>,
  "summary": "<one sentence overall read>",
  "perspectivesChecked": ["spelling","grammar","consistency","completeness","truthfulness","jd_ats","impact","formatting","red_flags"],
  "issues": [
    {"perspective":"spelling|grammar|consistency|completeness|truthfulness|jd_ats|impact|formatting|red_flags",
     "severity":"high|medium|low",
     "issue":"<what's wrong>",
     "where":"<exact text / section / bullet>",
     "suggestion":"<concrete fix>"}
  ]
}
verdict = "needs_fixes" if ANY high-severity issue exists; "minor_issues" if only medium/low;
"pass" if essentially clean.

${CLI_RULES}

${candidateContext()}

═══════════════════════════════════════════════════════
CANDIDATE'S REAL FACTS — the ONLY metrics/claims allowed.
Anything in the resume beyond these is FABRICATION → flag as truthfulness/high.
═══════════════════════════════════════════════════════
${masterBrief}`;

  const prompt = `Review this generated resume against the target job.

═══ TARGET JOB DESCRIPTION ═══
${jd && String(jd).trim() ? String(jd).trim() : '(no JD provided — review on general merits + truthfulness + completeness)'}

═══ GENERATED RESUME CONTENT ═══
${resumeText}`;

  return { system, prompt };
}

/**
 * Coerce a model-supplied score into a safe integer 0–100, or null.
 * Accepts numbers and numeric strings ("90"); clamps out-of-range values and
 * rounds floats — the spec is an integer 0–100, so anything else is repaired
 * rather than leaked to the UI as "ATS 150/100".
 */
export function normalizeScore(raw) {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.max(0, Math.min(100, n)));
}

/** Parse the model's JSON output into a safe, normalized QA object. */
export function parseResumeQa(text) {
  const raw = String(text || '');
  // Tolerant extraction: strips <think> reasoning blocks / code fences and
  // salvages truncated JSON (reasoning models overflow the token budget mid-array).
  const obj = extractJson(raw);
  if (!obj || typeof obj !== 'object') {
    return {
      verdict: 'unknown',
      score: null,
      summary: 'QA model returned unparseable output.',
      perspectivesChecked: [],
      issues: [],
      raw: raw.slice(0, 500),
      checkedAt: new Date().toISOString(),
    };
  }
  const issues = (Array.isArray(obj.issues) ? obj.issues : []).map((it) => ({
    perspective: String(it?.perspective || 'general'),
    severity: ['high', 'medium', 'low'].includes(it?.severity) ? it.severity : 'medium',
    issue: String(it?.issue || ''),
    where: String(it?.where || ''),
    suggestion: String(it?.suggestion || ''),
  }));
  const verdict = ['pass', 'minor_issues', 'needs_fixes'].includes(obj.verdict)
    ? obj.verdict
    : issues.some((i) => i.severity === 'high')
      ? 'needs_fixes'
      : issues.length
        ? 'minor_issues'
        : 'pass';
  return {
    verdict,
    score: normalizeScore(obj.score),
    summary: obj.summary || '',
    perspectivesChecked: Array.isArray(obj.perspectivesChecked) ? obj.perspectivesChecked : [],
    issues,
    checkedAt: new Date().toISOString(),
  };
}
