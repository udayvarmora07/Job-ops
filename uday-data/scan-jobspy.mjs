#!/usr/bin/env node

/**
 * scan-jobspy.mjs — non-ATS job scanner (Indeed + LinkedIn) via jobspy-node.
 *
 * jobops' scan.mjs only reads structured ATS boards (Greenhouse/Ashby/
 * Lever/Workday/...). It CANNOT see LinkedIn / Indeed / Naukri — which is where
 * most India DevOps roles actually post. This script fills that gap and feeds
 * results into the SAME pipeline (data/pipeline.md + data/scan-history.tsv),
 * reusing scan.mjs's title filter, dedup, and writers so everything downstream
 * (evaluate → tailor CV → tracker) just works.
 *
 * Naukri is currently blocked (HTTP 406 anti-bot) in jobspy-node, so the
 * default sites are indeed + linkedin.
 *
 * Usage (run from anywhere — it chdirs to the repo root):
 *   node uday-data/scan-jobspy.mjs                 # scan + write
 *   node uday-data/scan-jobspy.mjs --dry-run       # preview, write nothing
 *   node uday-data/scan-jobspy.mjs --sites indeed  # override sites
 *
 * Config (optional) in portals.yml under a `jobspy:` key:
 *   jobspy:
 *     sites: [indeed, linkedin]
 *     search_terms: ["DevOps Engineer", "Site Reliability Engineer"]
 *     location: "India"
 *     results_per_term: 20
 *     hours_old: 336          # only postings from the last N hours (14 days)
 * Falls back to sensible India-DevOps defaults when the key is absent.
 *
 * NOTE: jobspy-node scrapes public listing pages (not official APIs). It can
 * break when sites change their HTML, and bulk scraping LinkedIn is against
 * their ToS — keep volumes modest and treat output as discovery, not truth.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { scrapeJobs } from 'jobspy-node';
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
const sitesFlagIdx = args.indexOf('--sites');
const sitesOverride = sitesFlagIdx !== -1 ? args[sitesFlagIdx + 1]?.split(',') : null;

// ── Config ──────────────────────────────────────────────────────────
const PORTALS_PATH = process.env.JOBOPS_PORTALS || 'portals.yml';
const cfg = existsSync(PORTALS_PATH) ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {}) : {};
const js = (cfg.jobspy && typeof cfg.jobspy === 'object') ? cfg.jobspy : {};

const SITES = sitesOverride || js.sites || ['indeed', 'linkedin'];
const SEARCH_TERMS = js.search_terms || [
  'DevOps Engineer',
  'Site Reliability Engineer',
  'Cloud Engineer',
  'Platform Engineer',
];
const LOCATION = js.location || 'India';
const RESULTS_PER_TERM = Number(js.results_per_term) || 20;
const HOURS_OLD = js.hours_old != null ? Number(js.hours_old) : 336; // 14 days

// Experience-fit knobs (override via portals.yml jobspy.fit.*).
const FIT = {
  ...DEFAULT_FIT,
  ...(js.fit && typeof js.fit === 'object' ? {
    myYears: js.fit.my_years ?? DEFAULT_FIT.myYears,
    maxRequiredYears: js.fit.max_required_years ?? DEFAULT_FIT.maxRequiredYears,
  } : {}),
};
// --no-fit disables the experience filter (e.g. to audit raw output).
const fitEnabled = !args.includes('--no-fit');

const titleFilter = buildTitleFilter(cfg.title_filter);

// ── Scan ────────────────────────────────────────────────────────────
async function main() {
  console.log(`jobspy scan — sites: ${SITES.join(', ')} | location: ${LOCATION} | terms: ${SEARCH_TERMS.length}`);
  if (dryRun) console.log('(dry run — no files will be written)');

  const { seen } = loadSeenUrls();

  let totalFound = 0;
  let filteredTitle = 0;
  let dupes = 0;
  const offers = [];
  const droppedByFit = []; // { company, title, reason } — shown for auditing
  const seenThisRun = new Set();
  const seenRoleThisRun = new Set(); // company::title — collapse LinkedIn reposts
  const warnings = [];

  for (const term of SEARCH_TERMS) {
    let result;
    try {
      result = await scrapeJobs({
        siteName: SITES,
        searchTerm: term,
        location: LOCATION,
        countryIndeed: LOCATION,
        resultsWanted: RESULTS_PER_TERM,
        hoursOld: HOURS_OLD,
        // Fetch JD text so the experience filter judges by the STATED
        // requirement, not the title (Indeed includes it by default).
        linkedinFetchDescription: fitEnabled,
      });
    } catch (err) {
      warnings.push(`"${term}": ${err.message}`);
      continue;
    }

    for (const w of result.meta?.warnings || []) warnings.push(`"${term}": ${w}`);
    for (const e of result.errors || []) warnings.push(`"${term}" [${e.site}/${e.code}]: ${e.message}`);

    const jobs = result.jobs || [];
    totalFound += jobs.length;

    for (const j of jobs) {
      const title = j.title || '';
      const url = j.jobUrl;
      if (!url) continue;

      if (!titleFilter(title)) { filteredTitle++; continue; }
      if (seen.has(url) || seenThisRun.has(url)) { dupes++; continue; }
      const roleKey = `${(j.company || '').toLowerCase().trim()}::${title.toLowerCase().trim()}`;
      if (seenRoleThisRun.has(roleKey)) { dupes++; continue; }
      seenThisRun.add(url);
      seenRoleThisRun.add(roleKey);

      if (fitEnabled) {
        const fit = fitsExperience(j, FIT);
        if (!fit.keep) {
          droppedByFit.push({ company: j.company || 'Unknown', title, reason: fit.reason });
          continue;
        }
      }

      offers.push({
        title,
        company: j.company || 'Unknown',
        url,
        location: j.location?.display || (j.isRemote ? 'Remote' : ''),
        source: `jobspy-${j.site}`,
      });
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
  console.log(`jobspy scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Total jobs found:     ${totalFound}`);
  console.log(`Filtered by title:    ${filteredTitle} removed`);
  console.log(`Duplicates:           ${dupes} skipped`);
  if (fitEnabled) {
    console.log(`Dropped (experience): ${droppedByFit.length} removed (needs >${FIT.maxRequiredYears} yrs)`);
  } else {
    console.log(`Experience filter:    OFF (--no-fit)`);
  }
  console.log(`New offers added:     ${offers.length}`);

  // Show WHY each was dropped so false-negatives are auditable at a glance.
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
