#!/usr/bin/env node

/**
 * scan-hn.mjs — "Ask HN: Who is hiring?" scanner (free, no API key).
 *
 * Every month Hacker News runs a "Who is hiring?" thread; each top-level comment
 * is one company's job post. The HN Search (Algolia) API exposes all of it for
 * free with no key:
 *   - latest thread:  /search?tags=story,author_whoishiring  (pick newest "hiring")
 *   - its comments:   /search?tags=comment,story_<id>&hitsPerPage=1000
 *
 * Posts are free text, not structured, so this is best-effort parsing: keep a
 * comment only if it mentions a DevOps-ish role AND is India- or remote-eligible,
 * then run the same experience-fit filter as the other scanners. Results flow
 * into the SAME pipeline (data/pipeline.md + data/scan-history.tsv).
 *
 * Because HN posts list MANY roles in one comment, the title NEGATIVE filter is
 * NOT applied here (it would drop a DevOps post just because it also mentions
 * "Java" or "Sales"). Only the POSITIVE DevOps keywords gate a comment in.
 *
 * Usage (run from anywhere — it chdirs to the repo root):
 *   node uday-data/scan-hn.mjs              # scan + write
 *   node uday-data/scan-hn.mjs --dry-run    # preview, write nothing
 *   node uday-data/scan-hn.mjs --no-fit     # skip experience filter
 *   node uday-data/scan-hn.mjs --remote-any # keep ANY remote post (not just India-eligible)
 *
 * NOTE: free HN/Algolia API — no key, ToS-clean. Low volume, high signal.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import {
  loadSeenUrls,
  appendToPipeline,
  appendToScanHistory,
} from '../scan.mjs';
import { fitsExperience, DEFAULT_FIT } from './fit-filter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fitEnabled = !args.includes('--no-fit');
const remoteAny = args.includes('--remote-any');

// ── Config ──────────────────────────────────────────────────────────
const PORTALS_PATH = process.env.CAREER_OPS_PORTALS || 'portals.yml';
const cfg = existsSync(PORTALS_PATH) ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {}) : {};
const hn = (cfg.hn && typeof cfg.hn === 'object') ? cfg.hn : {};
const FIT = {
  ...DEFAULT_FIT,
  ...(hn.fit && typeof hn.fit === 'object' ? {
    myYears: hn.fit.my_years ?? DEFAULT_FIT.myYears,
    maxRequiredYears: hn.fit.max_required_years ?? DEFAULT_FIT.maxRequiredYears,
  } : {}),
};

// DevOps positive keywords — pulled from portals.yml so it stays in sync with
// the rest of the system. Falls back to a sensible default set.
const POSITIVE = (cfg.title_filter && Array.isArray(cfg.title_filter.positive) && cfg.title_filter.positive.length
  ? cfg.title_filter.positive
  : ['DevOps', 'SRE', 'Site Reliability', 'Platform Engineer', 'Cloud Engineer',
     'Infrastructure', 'Kubernetes', 'DevSecOps', 'CI/CD', 'Reliability Engineer'])
  .map((s) => s.toLowerCase());

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const stripHtml = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x2F;/g, '/').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// India-eligible: explicitly India, OR remote/worldwide and NOT locked to a
// non-India region. Keeps the bar consistent with scan-remote.mjs.
const INDIA_RE = /\b(india|bangalore|bengaluru|mumbai|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|ahmedabad|remote\s*-?\s*india)\b/i;
const REMOTE_RE = /\b(remote|worldwide|anywhere|distributed|work from home|wfh)\b/i;
// Non-India region locks. INDIA_RE is checked first, so a post that mentions
// India is never dropped by these — they only prune India-less remote posts
// that are quietly US/EU-only (very common on HN).
const US_LOCK_RE = new RegExp(
  [
    'us[\\s-]?only', 'usa[\\s-]?only', 'u\\.s\\.[\\s-]?only', 'us[\\s-]?based only',
    'must be (?:located )?in the (?:us|usa|united states)',
    '(?:us|eu|uk)[\\s-]?based candidates',
    'remote\\s*[\\(\\-,:]\\s*(?:us|usa|united states|north america|americas|emea|eu|uk|europe|canada)\\b',
    'us\\s*time\\s*zones?', '(?:est|pst|cst|pt|et)\\s*time\\s*zone',
    'north america only', 'americas only', 'us\\s*/\\s*canada',
    'onsite', 'on-site', 'in[\\s-]?office',
  ].join('|'),
  'i',
);

function eligible(blob) {
  if (INDIA_RE.test(blob)) return true;            // explicit India wins
  if (remoteAny && REMOTE_RE.test(blob)) return true;
  if (REMOTE_RE.test(blob) && !US_LOCK_RE.test(blob)) return true; // remote & not US-locked
  return false;
}

// Pull a clean role title from the post (first DevOps-ish role phrase), else generic.
const ROLE_RE = /\b((?:senior|sr\.?|staff|principal|lead)\s+)?(devops|devsecops|sre|site reliability|platform|cloud|infrastructure|systems?|reliability)\s+(engineer|developer|specialist|administrator|architect)\b/i;
function extractTitle(blob) {
  const m = blob.match(ROLE_RE);
  return m ? m[0].replace(/\s+/g, ' ').trim() : 'DevOps / Infrastructure role';
}

// First external apply URL in the comment; fallback to the HN comment permalink.
function extractUrl(blob, objectID) {
  const m = blob.match(/https?:\/\/[^\s)|>\]]+/i);
  if (m && !/news\.ycombinator\.com/i.test(m[0])) return m[0].replace(/[.,);]+$/, '');
  return `https://news.ycombinator.com/item?id=${objectID}`;
}

async function main() {
  console.log(`HN "Who is hiring" scan${remoteAny ? ' | --remote-any' : ''}`);
  if (dryRun) console.log('(dry run — no files will be written)');

  // 1. Find the newest "Ask HN: Who is hiring?" thread (poster: whoishiring).
  const stories = await getJson('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10');
  const thread = (stories.hits || []).find((h) => /who.?is hiring/i.test(h.title || ''));
  if (!thread) { console.log('No "Who is hiring" thread found.'); return; }
  console.log(`Thread: "${thread.title}" (${thread.num_comments} comments, id ${thread.objectID})`);

  // 2. Pull its top-level comments (each = one job post).
  const data = await getJson(`https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=1000`);
  const comments = data.hits || [];

  const { seen } = loadSeenUrls();
  const seenThisRun = new Set();
  let totalFound = comments.length, fKeyword = 0, fLoc = 0, fFit = 0, dupes = 0;
  const offers = [];
  const droppedByFit = [];

  for (const c of comments) {
    const blob = stripHtml(c.comment_text);
    if (!blob) continue;
    const low = blob.toLowerCase();

    if (!POSITIVE.some((kw) => low.includes(kw))) { fKeyword++; continue; }
    if (!eligible(blob)) { fLoc++; continue; }

    const company = (blob.split('|')[0] || '').trim().slice(0, 60) || 'Unknown';
    const title = extractTitle(blob);
    const url = extractUrl(blob, c.objectID);

    if (seen.has(url) || seenThisRun.has(url)) { dupes++; continue; }
    seenThisRun.add(url);

    if (fitEnabled) {
      const fit = fitsExperience({ title, description: blob }, FIT);
      if (!fit.keep) { fFit++; droppedByFit.push({ company, title, reason: fit.reason }); continue; }
    }

    offers.push({
      title,
      company,
      url,
      location: INDIA_RE.test(blob) ? 'India / Remote' : 'Remote',
      source: 'hn-whoishiring',
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  if (!dryRun && offers.length > 0) {
    appendToPipeline(offers);
    appendToScanHistory(offers, date);
  }

  console.log(`\n${'━'.repeat(45)}`);
  console.log(`HN Who-is-hiring scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Comments scanned:        ${totalFound}`);
  console.log(`No DevOps keyword:       ${fKeyword} removed`);
  console.log(`Not India/remote-ok:     ${fLoc} removed`);
  if (fitEnabled) console.log(`Dropped (experience):    ${fFit} removed (needs >${FIT.maxRequiredYears} yrs)`);
  console.log(`Duplicates:              ${dupes} skipped`);
  console.log(`New offers added:        ${offers.length}`);

  if (fitEnabled && droppedByFit.length > 0) {
    console.log('\nDropped (too senior) — audit:');
    for (const d of droppedByFit) console.log(`  - ${d.company} | ${d.title}  [${d.reason}]`);
  }
  if (offers.length > 0) {
    console.log('\nNew offers:');
    for (const o of offers) console.log(`  + [${o.source}] ${o.company} | ${o.title} | ${o.location}`);
    console.log(dryRun ? '\n(dry run — run without --dry-run to save)' : '\nSaved to data/pipeline.md and data/scan-history.tsv');
  }
  console.log('\n→ Run /career-ops pipeline to evaluate new offers.');
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
