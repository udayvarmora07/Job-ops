/**
 * lib-outreach/keys.mjs — loads .env and exposes the outreach API-key pools.
 *
 * Every provider may have MULTIPLE keys (different free accounts) for failover:
 * the engine tries key #1, and only falls through to #2, #3, ... if the previous
 * one errors or is out of credit. Keys live in .env (gitignored). This module is
 * the single place that reads them, mirroring lib-ai/config.mjs.
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function findRoot() {
  if (process.env.JOBOPS_ROOT && existsSync(process.env.JOBOPS_ROOT)) {
    return process.env.JOBOPS_ROOT;
  }
  const markers = ['config/ai.yml', 'cv.md', '.env'];
  const bases = [];
  try { bases.push(dirname(fileURLToPath(import.meta.url))); } catch { /* bundled */ }
  bases.push(process.cwd());
  for (const base of bases) {
    let dir = base;
    for (let i = 0; i < 8; i++) {
      if (markers.some((m) => existsSync(join(dir, m)))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  try { return join(dirname(fileURLToPath(import.meta.url)), '..'); } catch { return process.cwd(); }
}

export const ROOT = findRoot();

try {
  const { config } = await import('dotenv');
  config({ path: join(ROOT, '.env') });
} catch {
  /* no dotenv — fall back to ambient environment */
}

/** Gather BASE, BASE_1, BASE_2, ... BASE_9 (de-duplicated, in order). */
function pool(base) {
  const names = [base, ...Array.from({ length: 9 }, (_, i) => `${base}_${i + 1}`)];
  const seen = new Set();
  const out = [];
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

export const KEYS = {
  hunter: () => pool('HUNTER_IO_API_KEY'),
  prospeo: () => pool('PROSPEO_API_KEY'),       // captures PROSPEO_API_KEY_1, _2, ...
  zerobounce: () => pool('ZERO_BOUNCE_API_KEY'),
  bouncer: () => pool('BOUNCER_API_KEY'),       // captures BOUNCER_API_KEY_1, _2, ...
  apify: () => pool('APIFY_TOKEN'),             // captures APIFY_TOKEN, APIFY_TOKEN_2, _3, ...
  apollo: () => pool('APOLLO_API_KEY'),         // captures APOLLO_API_KEY_1, _2, _3, _4, ...
  pdl: () => pool('PDL_API_KEY'),              // captures PDL_API_KEY_1, _2, _3, ...
  snov: () => {
    const id = process.env.SNOV_API_USER_ID?.trim();
    const secret = process.env.SNOV_API_USER_SECRET?.trim();
    return id && secret ? { id, secret } : null;
  },
};

/** Quick presence report for diagnostics. */
export function keyStatus() {
  return {
    hunter: KEYS.hunter().length,
    prospeo: KEYS.prospeo().length,
    zerobounce: KEYS.zerobounce().length,
    bouncer: KEYS.bouncer().length,
    apify: KEYS.apify().length,
    apollo: KEYS.apollo().length,
    pdl: KEYS.pdl().length,
    snov: KEYS.snov() ? 1 : 0,
  };
}
