#!/usr/bin/env node

/**
 * scan-remote.mjs — remote-job scanner for India-eligible DevOps roles.
 *
 * Aggregates the free, no-key remote boards that actually carry worldwide /
 * India-eligible roles (most remote boards are US/EU-locked and were rejected
 * after testing: Jobicy, Arbeitnow, The Muse, Working Nomads, Himalayas).
 * Each source returns {title, company, url, location, description}; everything
 * then flows through ONE filter chain and into the same pipeline as scan.mjs:
 *
 *   title filter (portals.yml)         — must be a DevOps-ish role
 *   remote-eligibility filter          — must accept India / worldwide
 *   experience-fit filter (fit-filter) — must not require > N years
 *   dedup (scan.mjs)                   — URL + company::role
 *   → data/pipeline.md + data/scan-history.tsv
 *
 * Adding a new board = add one entry to PROVIDERS below.
 *
 * Usage (run from anywhere — it chdirs to repo root):
 *   node uday-data/scan-remote.mjs              # scan + write   (npm run scan:remote)
 *   node uday-data/scan-remote.mjs --dry-run    # preview only
 *   node uday-data/scan-remote.mjs --no-fit     # skip experience filter
 *   node uday-data/scan-remote.mjs --loose      # keep ambiguous-location roles too
 *
 * NOTE: public scrape/feed endpoints — can change or rate-limit. Discovery only.
 */

import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
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
const loose = args.includes('--loose'); // keep ambiguous-location roles

// ── Config ──────────────────────────────────────────────────────────
const PORTALS_PATH = process.env.JOBOPS_PORTALS || 'portals.yml';
const cfg = existsSync(PORTALS_PATH) ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {}) : {};
const rcfg = (cfg.remote && typeof cfg.remote === 'object') ? cfg.remote : {};
const FIT = {
  ...DEFAULT_FIT,
  ...(rcfg.fit ? {
    myYears: rcfg.fit.my_years ?? DEFAULT_FIT.myYears,
    maxRequiredYears: rcfg.fit.max_required_years ?? DEFAULT_FIT.maxRequiredYears,
  } : {}),
};
const titleFilter = buildTitleFilter(cfg.title_filter);

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// ── Remote-eligibility filter ───────────────────────────────────────
// A remote role is usable only if an India-based candidate can take it.
//   keep  → location mentions India / worldwide / anywhere / global / APAC / Asia
//   drop  → location is locked to a non-India region (US/EU/UK/LATAM/...)
//   else  → ambiguous/empty: dropped by default, kept with --loose
const POSITIVE_LOC = /\b(worldwide|anywhere|global|remote\s*-?\s*global|india|apac|asia[\s-]*pacific|asia)\b/i;
const REGION_LOCK = /\b(us|usa|u\.s\.|united states|us[\s-]?only|americas|north america|latam|latin america|uk|united kingdom|england|eu|emea|europe|european|germany|poland|netherlands|spain|portugal|france|ireland|canada|australia|brazil|mexico|argentina|costa rica|latvia|philippines|singapore|japan|uae|dubai)\b/i;

function remoteEligible(location) {
  const loc = String(location || '').trim();
  if (!loc) return loose;                 // empty → only with --loose
  if (POSITIVE_LOC.test(loc)) return true; // explicit worldwide/India wins
  if (REGION_LOCK.test(loc)) return false; // locked to a non-India region
  return loose;                            // ambiguous → only with --loose
}

// Non-English (Portuguese/Spanish) job markers. Many LATAM roles are tagged
// "Anywhere in the World" but the posting is Portuguese/Spanish — unusable for
// Uday. These tokens don't collide with English DevOps titles, so matching any
// one is a safe drop. (Plain English "Senior"/"Junior" are NOT here.)
const NON_ENGLISH = /\b(engenheir[oa]|desenvolvedor|pessoa|vaga|remoto|s[êé]nior|pj\b|efetivo|profissional|pleno|j[úu]nior\b|requisitos|conhecimento|ingenier[oa]|desarrollador|trabajo|empleo|espa[ñn]ol)\b/i;
function isEnglish(title, description = '') {
  return !NON_ENGLISH.test(`${title} ${description.slice(0, 200)}`);
}

// ── Providers (each returns [{title, company, url, location, description}]) ──
async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const PROVIDERS = [
  {
    id: 'weworkremotely',
    async fetch() {
      const xml = await getText('https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss');
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      const pick = (block, tag) => {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      };
      return items.map((it) => {
        const rawTitle = pick(it, 'title');         // "Company: Role"
        const colon = rawTitle.indexOf(':');
        const company = colon > -1 ? rawTitle.slice(0, colon).trim() : 'Unknown';
        const title = colon > -1 ? rawTitle.slice(colon + 1).trim() : rawTitle;
        return {
          title,
          company,
          url: pick(it, 'link'),
          location: pick(it, 'region'),
          description: stripHtml(pick(it, 'description')),
        };
      });
    },
  },
  {
    id: 'remotive',
    async fetch() {
      const d = await getJson('https://remotive.com/api/remote-jobs?category=devops');
      return (d.jobs || []).map((j) => ({
        title: j.title || '',
        company: j.company_name || 'Unknown',
        url: j.url,
        location: j.candidate_required_location || '',
        description: stripHtml(j.description),
      }));
    },
  },
  {
    id: 'remoteok',
    async fetch() {
      const d = await getJson('https://remoteok.com/api?tags=devops');
      return (Array.isArray(d) ? d : [])
        .filter((x) => x && x.position && x.id) // first element is legal notice
        .map((j) => ({
          title: j.position || '',
          company: j.company || 'Unknown',
          url: j.url || j.apply_url,
          location: j.location || (Array.isArray(j.tags) && j.tags.includes('worldwide') ? 'Worldwide' : ''),
          description: stripHtml(j.description),
        }));
    },
  },
];

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`remote scan — sources: ${PROVIDERS.map((p) => p.id).join(', ')}${loose ? ' | --loose' : ''}`);
  if (dryRun) console.log('(dry run — no files will be written)');

  const { seen } = loadSeenUrls();
  const seenThisRun = new Set();
  const seenRoleThisRun = new Set();

  let totalFound = 0, fTitle = 0, fLoc = 0, fLang = 0, fFit = 0, dupes = 0;
  const offers = [];
  const droppedByFit = [];
  const warnings = [];

  for (const prov of PROVIDERS) {
    let jobs;
    try {
      jobs = await prov.fetch();
    } catch (err) {
      warnings.push(`${prov.id}: ${err.message}`);
      continue;
    }
    totalFound += jobs.length;

    for (const j of jobs) {
      if (!j.url || !j.title) continue;
      if (!titleFilter(j.title)) { fTitle++; continue; }
      if (!remoteEligible(j.location)) { fLoc++; continue; }
      if (!isEnglish(j.title, j.description)) { fLang++; continue; }
      if (seen.has(j.url) || seenThisRun.has(j.url)) { dupes++; continue; }
      const roleKey = `${j.company.toLowerCase().trim()}::${j.title.toLowerCase().trim()}`;
      if (seenRoleThisRun.has(roleKey)) { dupes++; continue; }

      if (fitEnabled) {
        const fit = fitsExperience(j, FIT);
        if (!fit.keep) { fFit++; droppedByFit.push({ company: j.company, title: j.title, reason: fit.reason, source: prov.id }); continue; }
      }

      seenThisRun.add(j.url);
      seenRoleThisRun.add(roleKey);
      offers.push({
        title: j.title,
        company: j.company,
        url: j.url,
        location: j.location || 'Remote',
        source: `remote-${prov.id}`,
      });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  if (!dryRun && offers.length > 0) {
    appendToPipeline(offers);
    appendToScanHistory(offers, date);
  }

  console.log(`\n${'━'.repeat(45)}`);
  console.log(`remote scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Total jobs found:        ${totalFound}`);
  console.log(`Filtered by title:       ${fTitle} removed`);
  console.log(`Filtered (not India-ok): ${fLoc} removed`);
  console.log(`Filtered (non-English):  ${fLang} removed`);
  if (fitEnabled) console.log(`Dropped (experience):    ${fFit} removed (needs >${FIT.maxRequiredYears} yrs)`);
  console.log(`Duplicates:              ${dupes} skipped`);
  console.log(`New offers added:        ${offers.length}`);

  if (fitEnabled && droppedByFit.length > 0) {
    console.log('\nDropped (too senior) — audit:');
    for (const d of droppedByFit) console.log(`  - [${d.source}] ${d.company} | ${d.title}  [${d.reason}]`);
  }
  if (offers.length > 0) {
    console.log('\nNew offers:');
    for (const o of offers) console.log(`  + [${o.source}] ${o.company} | ${o.title} | ${o.location}`);
    console.log(dryRun ? '\n(dry run — run without --dry-run to save)' : '\nSaved to data/pipeline.md and data/scan-history.tsv');
  }
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  }
  console.log('\n→ Run /jobops pipeline to evaluate new offers.');
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
