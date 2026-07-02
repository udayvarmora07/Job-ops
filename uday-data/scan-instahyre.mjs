#!/usr/bin/env node

/**
 * scan-instahyre.mjs — India-native DevOps scanner via Instahyre's public API.
 *
 * Instahyre is one of the highest-density India-native sources for DevOps/SRE/
 * Cloud roles (incl. remote-India "Work From Home"), and scan.mjs's ATS
 * providers cannot reach it. This script reads Instahyre's public, no-auth JSON
 * endpoint and feeds results into the SAME pipeline (data/pipeline.md +
 * data/scan-history.tsv), reusing scan.mjs's title filter, dedup, and writers so
 * everything downstream (evaluate → tailor CV → tracker) just works.
 *
 * ENDPOINT (undocumented, internal):
 *   GET https://www.instahyre.com/api/v1/job_search/?job_functions=8&limit=35&offset=N
 *   → { objects: [{ title, public_url, locations, employer:{company_name}, ... }],
 *       meta: { next, ... } }
 * The anonymous endpoint only honors job_functions/limit/offset — its
 * experience/location params are IGNORED — and it returns NO JD description.
 * So filtering happens entirely client-side: the title filter (portals.yml) and
 * the experience-fit filter (title-only, since there's no JD text to parse).
 * Job-function IDs probed: 3=Frontend, 4=PM, 5=QA, 7=Design, 8=DevOps/Infra,
 * 10=Backend, 11=Product, 12=Eng-Mgmt.
 *
 * Usage (run from anywhere — it chdirs to the repo root):
 *   node uday-data/scan-instahyre.mjs              # scan + write
 *   node uday-data/scan-instahyre.mjs --dry-run    # preview, write nothing
 *   node uday-data/scan-instahyre.mjs --no-fit     # skip experience filter
 *
 * Config (optional) in portals.yml under `instahyre:`:
 *   instahyre:
 *     job_functions: [8]    # 8 = DevOps / Infrastructure
 *     pages: 4              # 35 jobs/page → up to ~140 scanned per function
 *     fit: { my_years: 1.5, max_required_years: 3 }
 *
 * NOTE: this is an internal endpoint, not an official API — it can change or
 * rate-limit without notice (ToS-gray). Treat output as discovery, not truth.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import {
  buildTitleFilter,
  loadSeenUrls,
  appendToPipeline,
  appendToScanHistory,
} from '../scan.mjs';
import { fitsExperience, DEFAULT_FIT } from './fit-filter.mjs';

// scan.mjs's writers use cwd-relative paths (data/pipeline.md, ...). Pin cwd to
// the repo root so this script works no matter where it's invoked from.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

// ── Args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fitEnabled = !args.includes('--no-fit');

// ── Config ──────────────────────────────────────────────────────────
const PORTALS_PATH = process.env.JOBOPS_PORTALS || 'portals.yml';
const cfg = existsSync(PORTALS_PATH) ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {}) : {};
const ih = (cfg.instahyre && typeof cfg.instahyre === 'object') ? cfg.instahyre : {};

const JOB_FUNCTIONS = Array.isArray(ih.job_functions) && ih.job_functions.length
  ? ih.job_functions
  : [8]; // 8 = DevOps / Infrastructure
const PAGES = Number(ih.pages) > 0 ? Number(ih.pages) : 4;
const PER_PAGE = 35; // Instahyre's fixed page size for this endpoint

const FIT = {
  ...DEFAULT_FIT,
  ...(ih.fit && typeof ih.fit === 'object' ? {
    myYears: ih.fit.my_years ?? DEFAULT_FIT.myYears,
    maxRequiredYears: ih.fit.max_required_years ?? DEFAULT_FIT.maxRequiredYears,
  } : {}),
};

const titleFilter = buildTitleFilter(cfg.title_filter);

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function fetchPage(jobFunction, offset) {
  const url = `https://www.instahyre.com/api/v1/job_search/?job_functions=${jobFunction}&limit=${PER_PAGE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Scan ────────────────────────────────────────────────────────────
async function main() {
  console.log(`instahyre scan — job_functions: ${JOB_FUNCTIONS.join(',')} | pages: ${PAGES} (~${PAGES * PER_PAGE}/fn)`);
  if (dryRun) console.log('(dry run — no files will be written)');

  const { seen } = loadSeenUrls();

  let totalFound = 0;
  let filteredTitle = 0;
  let dupes = 0;
  const offers = [];
  const droppedByFit = []; // { company, title, reason } — shown for auditing
  const seenThisRun = new Set();
  const seenRoleThisRun = new Set();
  const warnings = [];

  for (const fn of JOB_FUNCTIONS) {
    for (let page = 0; page < PAGES; page++) {
      let data;
      try {
        data = await fetchPage(fn, page * PER_PAGE);
      } catch (err) {
        warnings.push(`jf=${fn} page=${page}: ${err.message}`);
        break; // stop paging this function on error
      }

      const jobs = data.objects || [];
      totalFound += jobs.length;

      for (const j of jobs) {
        const title = j.title || '';
        const url = j.public_url;
        const company = (j.employer && j.employer.company_name) || 'Unknown';
        if (!url || !title) continue;

        if (!titleFilter(title)) { filteredTitle++; continue; }
        if (seen.has(url) || seenThisRun.has(url)) { dupes++; continue; }
        const roleKey = `${company.toLowerCase().trim()}::${title.toLowerCase().trim()}`;
        if (seenRoleThisRun.has(roleKey)) { dupes++; continue; }
        seenThisRun.add(url);
        seenRoleThisRun.add(roleKey);

        if (fitEnabled) {
          // No JD description on this endpoint → fit-filter judges by title only.
          const fit = fitsExperience({ title }, FIT);
          if (!fit.keep) {
            droppedByFit.push({ company, title, reason: fit.reason });
            continue;
          }
        }

        offers.push({
          title,
          company,
          url,
          location: j.locations || 'India',
          source: 'instahyre',
        });
      }

      // Last page reached (Instahyre signals end via a null `next`).
      if (!data.meta || !data.meta.next || jobs.length < PER_PAGE) break;
    }
  }

  // ── Write ─────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  if (!dryRun && offers.length > 0) {
    appendToPipeline(offers);
    appendToScanHistory(offers, date);
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log(`\n${'━'.repeat(45)}`);
  console.log(`instahyre scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Total jobs found:     ${totalFound}`);
  console.log(`Filtered by title:    ${filteredTitle} removed`);
  console.log(`Duplicates:           ${dupes} skipped`);
  if (fitEnabled) {
    console.log(`Dropped (experience): ${droppedByFit.length} removed (title-only; needs >${FIT.maxRequiredYears} yrs)`);
  } else {
    console.log(`Experience filter:    OFF (--no-fit)`);
  }
  console.log(`New offers added:     ${offers.length}`);

  if (fitEnabled && droppedByFit.length > 0) {
    console.log('\nDropped (too senior for ~1.5 yrs) — audit these:');
    for (const d of droppedByFit) {
      console.log(`  - ${d.company} | ${d.title}  [${d.reason}]`);
    }
  }

  if (offers.length > 0) {
    console.log('\nNew offers:');
    for (const o of offers) {
      console.log(`  + [${o.source}] ${o.company} | ${o.title} | ${o.location || 'N/A'}`);
    }
    console.log(dryRun
      ? '\n(dry run — run without --dry-run to save)'
      : '\nResults saved to data/pipeline.md and data/scan-history.tsv');
  }

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  }

  console.log('\n→ Run /jobops pipeline to evaluate new offers.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
