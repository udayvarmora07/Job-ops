#!/usr/bin/env node
/**
 * ats-check.mjs
 *
 * Renders a resume content JSON as ATS-readable plain text, then builds the
 * complete ATS review prompt ready to copy into Gemini, ChatGPT, or Claude.
 *
 * Usage:
 *   node uday-data/resume-system/ats-check.mjs <content.json>
 *   node uday-data/resume-system/ats-check.mjs <content.json> --jd jds/acme.txt
 *   node uday-data/resume-system/ats-check.mjs content/nexthink.json --jd "Senior Platform Engineer…"
 *
 * Output:
 *   - Prints resume as plain text to stdout (what ATS actually reads)
 *   - Saves full ATS prompt to output/ats-prompt-<suffix>-<date>.txt
 *   - Prints next-step instructions
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ─── CLI ARGS ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (!args[0] || args[0] === '--help') {
  console.log(`
ats-check.mjs — ATS Resume Analyzer

Usage:
  node uday-data/resume-system/ats-check.mjs <content.json> [--jd <file-or-text>]

Examples:
  node uday-data/resume-system/ats-check.mjs uday-data/resume-system/content/nexthink.json
  node uday-data/resume-system/ats-check.mjs content/nexthink.json --jd jds/nexthink.txt
  node uday-data/resume-system/ats-check.mjs content/nexthink.json --jd "Senior SRE role at..."
`);
  process.exit(0);
}

let contentPath = args[0];

// Resolve relative to content/ dir if not found directly
if (!existsSync(contentPath)) {
  const inContent = resolve(__dirname, 'content', contentPath);
  if (existsSync(inContent)) {
    contentPath = inContent;
  } else {
    console.error(`Error: file not found: ${contentPath}`);
    process.exit(1);
  }
}

let content;
try {
  content = JSON.parse(readFileSync(contentPath, 'utf8'));
} catch (e) {
  console.error(`Error reading JSON: ${e.message}`);
  process.exit(1);
}

// ─── JD ──────────────────────────────────────────────────────────────────────

let jdText = '';
const jdIdx = args.indexOf('--jd');
if (jdIdx !== -1 && args[jdIdx + 1]) {
  const jdArg = args[jdIdx + 1];
  if (existsSync(resolve(jdArg))) {
    jdText = readFileSync(resolve(jdArg), 'utf8').trim();
  } else if (existsSync(resolve(ROOT, jdArg))) {
    jdText = readFileSync(resolve(ROOT, jdArg), 'utf8').trim();
  } else {
    jdText = jdArg.trim();
  }
}

// ─── RENDER HELPERS ──────────────────────────────────────────────────────────

const stripBold = (s) => (s || '').replace(/\*\*(.*?)\*\*/g, '$1');
const line = (n = 60) => '─'.repeat(n);

// ─── PLAIN TEXT RENDERER ─────────────────────────────────────────────────────

function renderResumeText(c) {
  const out = [];

  out.push('UDAY VARMORA');
  out.push('+91 96623 85170  |  varmorauday1045@gmail.com  |  linkedin.com/in/udayvarmora  |  github.com/udayvarmora07  |  Ahmedabad, India');
  out.push('');

  out.push(line());
  out.push('SUMMARY');
  out.push(line());
  out.push(stripBold(c.summary || ''));
  out.push('');

  out.push(line());
  out.push('TECHNICAL SKILLS');
  out.push(line());
  for (const [category, items] of (c.skills || [])) {
    out.push(`${category}: ${stripBold(items)}`);
  }
  out.push('');

  out.push(line());
  out.push('EXPERIENCE');
  out.push(line());
  for (const exp of (c.experience || [])) {
    out.push(`${exp.role}  |  ${exp.org}  |  ${exp.dates}`);
    for (const bullet of (exp.bullets || [])) {
      out.push(`  • ${stripBold(bullet)}`);
    }
    out.push('');
  }

  out.push(line());
  out.push('PROJECTS');
  out.push(line());
  for (const proj of (c.projects || [])) {
    out.push(proj.title);
    out.push(`Tech Stack: ${proj.tech}`);
    for (const bullet of (proj.bullets || [])) {
      out.push(`  • ${stripBold(bullet)}`);
    }
    out.push('');
  }

  out.push(line());
  out.push('EDUCATION');
  out.push(line());
  out.push(stripBold(c.education?.left || ''));
  out.push('');

  if (c.achievements?.length) {
    out.push(line());
    out.push('ACHIEVEMENTS');
    out.push(line());
    for (const a of c.achievements) {
      out.push(`  • ${stripBold(a)}`);
    }
    out.push('');
  }

  return out.join('\n');
}

// ─── KEYWORD STATS ───────────────────────────────────────────────────────────

function computeKeywordStats(resumeText) {
  const words = resumeText.toLowerCase().match(/\b[a-z][a-z0-9+#.\-]{2,}\b/g) || [];
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30);
  return sorted.map(([w, n]) => `${w} (${n}x)`).join(', ');
}

// ─── BUILD PROMPT ────────────────────────────────────────────────────────────

function buildATSPrompt(resumeText, jd, suffix) {
  const hasJD = jd.trim().length > 0;

  return `Do in-depth detailed research for these.
Think from all different perspectives and cover all points and perspectives.

Here is a job description I'm applying for. Compare it with my resume and tell me exactly:

1. Which keywords are missing (sorted by importance — critical required → nice-to-have)
2. Which skills I should highlight more prominently and where
3. How I should restructure specific bullet points to better pass ATS screening
4. Any grammar, spelling, or phrasing mistakes (NOTE: British -ise spellings like "Dockerised", "containerised" are INTENTIONAL — do not flag these)
5. What should I add or remove to improve clarity, impact, and ATS match
6. Tips and tricks to increase ATS score

Score out of 100.

Format your response EXACTLY like this:

════════════════════════════════════════════
ATS SCORE: XX/100
(brief reason for this score)
════════════════════════════════════════════

MISSING KEYWORDS — add these to raise your score:
CRITICAL (required in JD, not in resume):
  - [keyword] → where to add: [summary / skills row name / bullet location]
RECOMMENDED (preferred in JD, could strengthen):
  - [keyword] → where to add: [location]

════════════════════════════════════════════

BULLET POINT RESTRUCTURING — copy-paste ready rewrites:
  [experience role / project title, bullet #]:
  CURRENT:  [existing text]
  IMPROVED: [rewritten to hit ATS keywords, same facts, stronger framing]

════════════════════════════════════════════

GRAMMAR / SPELLING / PHRASING MISTAKES:
  - [mistake] → [correction]
  (Remember: -ise spellings are intentional British English — skip those)

════════════════════════════════════════════

SKILLS SECTION — reorder suggestion (if any):
  Current order: [row 1 category, row 2 category, ...]
  Suggested:     [reordered — put JD's most-wanted category first]

════════════════════════════════════════════

QUICK WINS — top 5 highest-impact changes (do these first):
  1.
  2.
  3.
  4.
  5.

════════════════════════════════════════════

${hasJD ? `=== JOB DESCRIPTION ===
${jd}

` : '⚠  NO JD PROVIDED — paste the job description above the resume for keyword comparison.\n\n'}=== MY RESUME (plain text — what ATS reads) ===
${resumeText}`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const suffix = basename(contentPath, extname(contentPath));
const date = new Date().toISOString().slice(0, 10);

const resumeText = renderResumeText(content);
const prompt = buildATSPrompt(resumeText, jdText, suffix);
const topKeywords = computeKeywordStats(resumeText);

// Save prompt file
mkdirSync(resolve(ROOT, 'output'), { recursive: true });
const outFile = resolve(ROOT, 'output', `ats-prompt-${suffix}-${date}.txt`);
writeFileSync(outFile, prompt, 'utf8');

// Save resume text snapshot too
const textFile = resolve(ROOT, 'output', `ats-resume-text-${suffix}-${date}.txt`);
writeFileSync(textFile, resumeText, 'utf8');

// ─── OUTPUT ──────────────────────────────────────────────────────────────────

console.log('');
console.log('═'.repeat(60));
console.log('  RESUME — PLAIN TEXT (what ATS engines read)');
console.log('═'.repeat(60));
console.log(resumeText);
console.log('═'.repeat(60));
console.log(`Top keywords in resume: ${topKeywords}`);
console.log('═'.repeat(60));
console.log('');
console.log('FILES SAVED:');
console.log(`  Resume text:  output/ats-resume-text-${suffix}-${date}.txt`);
console.log(`  ATS prompt:   output/ats-prompt-${suffix}-${date}.txt`);
console.log('');

if (!jdText) {
  console.log('⚠  No JD provided — add --jd <file-or-text> to include the job description.');
  console.log('   Edit the saved prompt file and paste the JD before sending to an LLM.');
  console.log('');
}

console.log('OPTION A — External LLM (Gemini / ChatGPT / Claude.ai):');
console.log('  Copy output/ats-prompt-' + suffix + '-' + date + '.txt → paste into LLM');
console.log('');
console.log('OPTION B — Claude Code native (right here):');
console.log('  Tell Claude: "ats review content/' + suffix + '.json" + paste the JD');
console.log('');
console.log('AFTER GETTING SUGGESTIONS:');
console.log('  Pick the ones you want → come back here and say:');
console.log('  "Apply these ATS updates to content/' + suffix + '.json: [your selected items]"');
console.log('');
