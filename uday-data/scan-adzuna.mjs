#!/usr/bin/env node

/**
 * scan-adzuna.mjs — India DevOps scanner via Adzuna's free official JSON API.
 *
 * Unlike the scrapers (jobspy/instahyre), Adzuna is an OFFICIAL, documented JSON
 * API — stable, ToS-clean, and won't break when a site changes its HTML. It has
 * a real India region, so this is the most reliable non-ATS source in the stack.
 * Results flow into the SAME pipeline (data/pipeline.md + data/scan-history.tsv),
 * reusing scan.mjs's title filter, dedup, and writers.
 *
 * The endpoint returns a JD description, so the experience-fit filter parses the
 * STATED years requirement (not just the title) — the strongest fit signal.
 *
 * SETUP (one-time): get a FREE app_id + app_key at https://developer.adzuna.com
 * (free tier ~250 calls/day) and put them in a gitignored .env at the repo root:
 *   ADZUNA_APP_ID=xxxxxxxx
 *   ADZUNA_APP_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * Usage (run from anywhere — it chdirs to the repo root):
 *   node uday-data/scan-adzuna.mjs              # scan + write
 *   node uday-data/scan-adzuna.mjs --dry-run    # preview, write nothing
 *   node uday-data/scan-adzuna.mjs --no-fit     # skip experience filter
 *
 * Config (optional) in portals.yml under `adzuna:`:
 *   adzuna:
 *     country: in                  # India region code
 *     search_terms: ["devops", "site reliability engineer", ...]
 *     results_per_term: 50
 *     max_days_old: 14
 *     fit: { my_years: 1.5, max_required_years: 3 }
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import yaml from 'js-yaml';
import {
  buildTitleFilter,
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

// ── Credentials (from .env) ─────────────────────────────────────────
const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
if (!APP_ID || !APP_KEY) {
  console.error('Missing Adzuna credentials. Add to a gitignored .env at the repo root:');
  console.error('  ADZUNA_APP_ID=xxxx');
  console.error('  ADZUNA_APP_KEY=xxxx');
  console.error('Get a free key at https://developer.adzuna.com');
  process.exit(1);
}

// ── Config ──────────────────────────────────────────────────────────
const PORTALS_PATH = process.env.JOBOPS_PORTALS || 'portals.yml';
const cfg = existsSync(PORTALS_PATH) ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {}) : {};
const az = (cfg.adzuna && typeof cfg.adzuna === 'object') ? cfg.adzuna : {};

const COUNTRY = (az.country || 'in').toLowerCase();
const SEARCH_TERMS = Array.isArray(az.search_terms) && az.search_terms.length
  ? az.search_terms
  : ['devops', 'site reliability engineer', 'cloud engineer', 'platform engineer'];
const RESULTS_PER_TERM = Number(az.results_per_term) || 50;
const MAX_DAYS_OLD = az.max_days_old != null ? Number(az.max_days_old) : 14;

const FIT = {
  ...DEFAULT_FIT,
  ...(az.fit && typeof az.fit === 'object' ? {
    myYears: az.fit.my_years ?? DEFAULT_FIT.myYears,
    maxRequiredYears: az.fit.max_required_years ?? DEFAULT_FIT.maxRequiredYears,
  } : {}),
};

const titleFilter = buildTitleFilter(cfg.title_filter);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function buildUrl(term) {
  const p = new URLSearchParams({
    app_id: APP_ID,
    app_key: APP_KEY,
    results_per_page: String(Math.min(RESULTS_PER_TERM, 50)),
    what: term,
    max_days_old: String(MAX_DAYS_OLD),
    'content-type': 'application/json',
  });
  return `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/1?${p.toString()}`;
}

async function main() {
  console.log(`adzuna scan — country: ${COUNTRY} | terms: ${SEARCH_TERMS.length} | ${RESULTS_PER_TERM}/term`);
  if (dryRun) console.log('(dry run — no files will be written)');

  const { seen } = loadSeenUrls();
  const seenThisRun = new Set();
  const seenRoleThisRun = new Set();

  let totalFound = 0, filteredTitle = 0, dupes = 0;
  const offers = [];
  const droppedByFit = [];
  const warnings = [];

  for (const term of SEARCH_TERMS) {
    let data;
    try {
      const res = await fetch(buildUrl(term), { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) { warnings.push(`"${term}": HTTP ${res.status}`); continue; }
      data = await res.json();
    } catch (err) {
      warnings.push(`"${term}": ${err.message}`);
      continue;
    }

    const jobs = data.results || [];
    totalFound += jobs.length;

    for (const j of jobs) {
      const title = j.title ? j.title.replace(/<[^>]+>/g, '').trim() : '';
      const url = j.redirect_url;
      const company = (j.company && j.company.display_name) || 'Unknown';
      if (!url || !title) continue;

      if (!titleFilter(title)) { filteredTitle++; continue; }
      if (seen.has(url) || seenThisRun.has(url)) { dupes++; continue; }
      const roleKey = `${company.toLowerCase().trim()}::${title.toLowerCase().trim()}`;
      if (seenRoleThisRun.has(roleKey)) { dupes++; continue; }
      seenThisRun.add(url);
      seenRoleThisRun.add(roleKey);

      if (fitEnabled) {
        // Adzuna returns a JD description → fit-filter judges by STATED years.
        const fit = fitsExperience({ title, description: j.description || '' }, FIT);
        if (!fit.keep) { droppedByFit.push({ company, title, reason: fit.reason }); continue; }
      }

      offers.push({
        title,
        company,
        url,
        location: (j.location && j.location.display_name) || 'India',
        source: 'adzuna',
      });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  if (!dryRun && offers.length > 0) {
    appendToPipeline(offers);
    appendToScanHistory(offers, date);
  }

  console.log(`\n${'━'.repeat(45)}`);
  console.log(`adzuna scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Total jobs found:     ${totalFound}`);
  console.log(`Filtered by title:    ${filteredTitle} removed`);
  console.log(`Duplicates:           ${dupes} skipped`);
  if (fitEnabled) console.log(`Dropped (experience): ${droppedByFit.length} removed (needs >${FIT.maxRequiredYears} yrs)`);
  else console.log(`Experience filter:    OFF (--no-fit)`);
  console.log(`New offers added:     ${offers.length}`);

  if (fitEnabled && droppedByFit.length > 0) {
    console.log('\nDropped (too senior for ~1.5 yrs) — audit these:');
    for (const d of droppedByFit) console.log(`  - ${d.company} | ${d.title}  [${d.reason}]`);
  }
  if (offers.length > 0) {
    console.log('\nNew offers:');
    for (const o of offers) console.log(`  + [${o.source}] ${o.company} | ${o.title} | ${o.location || 'N/A'}`);
    console.log(dryRun ? '\n(dry run — run without --dry-run to save)' : '\nResults saved to data/pipeline.md and data/scan-history.tsv');
  }
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  }
  console.log('\n→ Run /jobops pipeline to evaluate new offers.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
