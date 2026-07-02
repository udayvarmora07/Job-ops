#!/usr/bin/env node

/**
 * scan-yc.mjs — Y Combinator India-hiring company DISCOVERY (not a job scanner).
 *
 * WHY THIS IS DIFFERENT FROM THE OTHER SCANNERS:
 * YC's actual job postings live on workatastartup.com, which is login-walled and
 * returns HTTP 406 to scripts (anti-bot) — there is no zero-cost path to the
 * job-LEVEL data. What IS freely available is the yc-oss company directory
 * (https://yc-oss.github.io/api/), a daily JSON mirror with an `isHiring` flag
 * and location/region fields — but NO job titles.
 *
 * So this script does the next best thing: it surfaces YC companies that are
 * (a) currently hiring and (b) based in / operating in India, and writes them to
 * a discovery report (uday-data/yc-india-hiring.md). Many of these startups post
 * their roles on Greenhouse/Ashby/Lever — which scan.mjs (the zero-token ATS
 * scanner) CAN read. The intended workflow is:
 *
 *   node uday-data/scan-yc.mjs   →   review uday-data/yc-india-hiring.md
 *     →   add the interesting ones' ATS boards to portals.yml
 *     →   npm run scan   (zero-token, high-quality ATS path)
 *
 * It deliberately does NOT write to data/pipeline.md, because these are
 * companies, not specific job postings — feeding untitled companies into the
 * evaluate pipeline would be noise.
 *
 * Usage (run from anywhere — it chdirs to the repo root):
 *   node uday-data/scan-yc.mjs            # write the discovery report
 *   node uday-data/scan-yc.mjs --dry-run  # print to stdout, write nothing
 *
 * Config (optional) in portals.yml under `yc:`:
 *   yc:
 *     regions: [India, "South Asia"]   # region tags to match (default: India)
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const PORTALS_PATH = process.env.JOBOPS_PORTALS || 'portals.yml';
const cfg = existsSync(PORTALS_PATH) ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {}) : {};
const yc = (cfg.yc && typeof cfg.yc === 'object') ? cfg.yc : {};
const REGIONS = Array.isArray(yc.regions) && yc.regions.length ? yc.regions : ['India'];

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const OUT = 'uday-data/yc-india-hiring.md';

// Indian-city fallback for companies whose `regions` array doesn't carry an
// India tag but whose `all_locations` clearly does.
const INDIA_CITY_RE =
  /\b(india|bangalore|bengaluru|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|ahmedabad|kolkata|jaipur|kochi|coimbatore)\b/i;

function isIndia(c) {
  const regions = c.regions || [];
  if (regions.some((r) => REGIONS.some((want) => r.toLowerCase() === String(want).toLowerCase())))
    return true;
  return INDIA_CITY_RE.test(c.all_locations || '');
}

async function main() {
  console.log(`YC discovery — regions: ${REGIONS.join(', ')}`);
  if (dryRun) console.log('(dry run — no file will be written)');

  const res = await fetch('https://yc-oss.github.io/api/companies/all.json', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching yc-oss company list`);
  const all = await res.json();

  const hits = all
    .filter((c) => c.isHiring && isIndia(c))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push('# YC companies hiring — India');
  lines.push('');
  lines.push(`_Generated ${date} by uday-data/scan-yc.mjs from the yc-oss company directory._`);
  lines.push('');
  lines.push('These are Y Combinator companies currently flagged `isHiring` with an');
  lines.push('India presence. This is **company discovery, not job postings** — YC');
  lines.push('job-level data is login-walled. Check each one for DevOps/SRE/Cloud roles');
  lines.push('and, if they use Greenhouse/Ashby/Lever, add their board to `portals.yml`');
  lines.push('so the zero-token `npm run scan` picks them up.');
  lines.push('');
  lines.push(`**${hits.length} companies** matched.`);
  lines.push('');
  lines.push('| Company | Location | Batch | Industry | Website |');
  lines.push('|---------|----------|-------|----------|---------|');
  for (const c of hits) {
    const industry = (c.industries && c.industries.length ? c.industries : [c.industry]).filter(Boolean).join(' / ');
    const loc = (c.all_locations || '').replace(/\|/g, '/');
    const site = c.website ? `[link](${c.website})` : '—';
    lines.push(`| ${c.name} | ${loc} | ${c.batch || ''} | ${industry || ''} | ${site} |`);
  }
  lines.push('');
  const report = lines.join('\n');

  if (dryRun) {
    console.log('\n' + report);
  } else {
    writeFileSync(OUT, report + '\n', 'utf-8');
  }

  console.log(`\n${'━'.repeat(45)}`);
  console.log(`YC discovery — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Companies scanned:    ${all.length}`);
  console.log(`Hiring + India:       ${hits.length}`);
  console.log(dryRun ? '\n(dry run — run without --dry-run to write the report)' : `\nReport written to ${OUT}`);
  console.log('\n→ Review the report, then add any good ATS boards to portals.yml and run npm run scan.');
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
