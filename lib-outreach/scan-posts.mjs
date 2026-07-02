/**
 * lib-outreach/scan-posts.mjs — discover LinkedIn "we're hiring" posts.
 *
 * Recruiters constantly post "Hiring a DevOps Engineer — send your CV to x@y.com".
 * The career-ops job scanner can't see LinkedIn, and the email-discovery engine
 * assumes you must *find* an address. These posts are the opposite: the address
 * is right there (usually in the FIRST COMMENT). This module finds those posts
 * via the off-account Apify actor `harvestapi/linkedin-post-search` (no cookies,
 * ~$0.002/post), pulls the apply email out of the body + comments, and dedups so
 * a post is only ever surfaced once.
 *
 * It NEVER sends anything. Output is a list of candidate posts for the user to
 * review; the resume + draft step is separate and review-gated.
 *
 * Apify tokens come from .env (APIFY_TOKEN, APIFY_TOKEN_2, ...). dotenv is loaded
 * as a side effect of importing keys.mjs (same pattern as the rest of lib-outreach).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ROOT } from './keys.mjs';
import { extractEmails } from '../lib-ai/tasks/parse-hiring-post.mjs';
import { scorePostFit } from './fit-post.mjs';

const ACTOR = 'harvestapi~linkedin-post-search';
const HISTORY = join(ROOT, 'data', 'post-scan-history.tsv');

/** Apify tokens in order (APIFY_TOKEN, _2, _3, …), de-duplicated. Mirrors find-people. */
export function apifyTokens() {
  const names = ['APIFY_TOKEN', ...Array.from({ length: 9 }, (_, i) => `APIFY_TOKEN_${i + 2}`)];
  const seen = new Set();
  const out = [];
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

/** post-scan-history.tsv: one row per seen post → "url\tfirst_seen\tquery". */
function loadHistory() {
  const seen = new Set();
  try {
    for (const line of readFileSync(HISTORY, 'utf8').split('\n')) {
      const url = line.split('\t')[0]?.trim();
      if (url) seen.add(url);
    }
  } catch { /* no history yet */ }
  return seen;
}

function appendHistory(rows) {
  if (!rows.length) return;
  mkdirSync(dirname(HISTORY), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const text = rows.map((r) => `${r.url}\t${today}\t${r.query || ''}`).join('\n') + '\n';
  try { writeFileSync(HISTORY, (existsSync(HISTORY) ? readFileSync(HISTORY, 'utf8') : '') + text); }
  catch { /* best-effort */ }
}

// The actor's field names vary; pull defensively from the likely candidates.
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function commentsText(post) {
  const list = post?.comments || post?.postComments || [];
  if (!Array.isArray(list)) return '';
  return list
    .map((c) => (typeof c === 'string' ? c : pick(c, 'text', 'comment', 'content', 'commentary')))
    .filter(Boolean)
    .join('\n');
}

/** Normalise one raw Apify post item → our candidate shape (+ extracted emails). */
function normalize(raw, query) {
  const url = pick(raw, 'url', 'linkedinUrl', 'postUrl', 'shareUrl', 'link');
  const text = pick(raw, 'content', 'text', 'commentary', 'postContent', 'description');
  const comments = commentsText(raw);
  const author = raw?.author || raw?.actor || {};
  return {
    url,
    postedAt: pick(raw, 'postedAt', 'postedDate', 'date', 'time') || (raw?.postedAtTimestamp ? String(raw.postedAtTimestamp) : ''),
    authorName: pick(author, 'name', 'fullName') || pick(raw, 'authorName', 'authorFullName'),
    authorTitle: pick(author, 'headline', 'occupation', 'subtitle') || pick(raw, 'authorHeadline'),
    text,
    comments,
    emails: extractEmails(`${text}\n${comments}`),
    query,
  };
}

/**
 * Run the post search.
 *
 * @param {object} opts
 * @param {string[]} opts.queries     search strings (e.g. ['hiring "DevOps" "send your resume" India'])
 * @param {number}  [opts.maxPosts=20]  hard cap on billed posts per run
 * @param {string}  [opts.postedLimit='week']  recency window — one of the actor's
 *                  allowed values: "any" | "1h" | "24h" | "week" | "month" | "3mo"
 * @param {boolean} [opts.emailOnly=true]  keep only posts that yielded an apply email
 * @param {boolean} [opts.fitOnly=true]   keep only posts that fit the user's profile
 * @param {number}  [opts.page=1]         1-based result page (for "show me more")
 * @param {boolean} [opts.includeSeen=false]  if true, don't filter against history
 * @returns {Promise<{posts:object[], stats:object}>}
 */
export async function scanPosts(opts = {}) {
  const {
    queries = [],
    maxPosts = 20,
    postedLimit = 'week',
    emailOnly = true,
    fitOnly = true,
    page = 1,
    includeSeen = false,
  } = opts;

  // The actor only accepts these exact recency windows; map common aliases, else
  // default to 'week'. (The "3mo"-style longer windows the actor lists are not a
  // stable token across versions, so we cap at 'month' to stay valid.)
  const ALLOWED_LIMITS = ['any', '1h', '24h', 'week', 'month'];
  const ALIASES = {
    'past-week': 'week', 'past-month': 'month', 'past-24h': '24h', day: '24h',
    '3mo': 'month', '3months': 'month', quarter: 'month', month3: 'month',
  };
  const limit = ALLOWED_LIMITS.includes(postedLimit)
    ? postedLimit
    : (ALIASES[postedLimit] || 'week');

  const tokens = apifyTokens();
  if (!tokens.length) {
    const err = new Error('APIFY_TOKEN not set in .env — needed for LinkedIn post discovery. (Manual paste still works.)');
    err.code = 'NO_APIFY_TOKEN';
    throw err;
  }
  if (!queries.length) throw new Error('scanPosts: provide at least one search query.');

  const startPage = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
  const input = {
    searchQueries: queries,
    maxPosts,
    postedLimit: limit,
    sortBy: 'date',
    scrapeComments: true,
    maxComments: 10,
    startPage,
    scrapePages: 1,
  };

  let rows = null;
  let lastError = '';
  for (let i = 0; i < tokens.length; i++) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(tokens[i])}&maxItems=${maxPosts}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
      );
      if (!res.ok) { lastError = `Apify HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; continue; }
      rows = await res.json();
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!Array.isArray(rows)) {
    const err = new Error(`All ${tokens.length} Apify token(s) failed. Last error: ${lastError}`);
    err.code = 'APIFY_FAILED';
    throw err;
  }

  const seen = includeSeen ? new Set() : loadHistory();
  const query = queries.join(' | ');
  const all = rows.map((r) => normalize(r, query)).filter((p) => p.url);

  // Dedup by URL (against history + within this run).
  const fresh = [];
  const runSeen = new Set();
  for (const p of all) {
    if (seen.has(p.url) || runSeen.has(p.url)) continue;
    runSeen.add(p.url);
    fresh.push(p);
  }

  const withEmail = fresh.filter((p) => p.emails.length > 0);

  // Score every post-with-email against the user's profile (roles/skills/experience).
  for (const p of withEmail) {
    p.fit = await scorePostFit(p);
  }
  const fitting = withEmail
    .filter((p) => p.fit.fits)
    .sort((a, b) => b.fit.score - a.fit.score);

  const result = fitOnly ? fitting : emailOnly ? withEmail : fresh;

  // Record every email-bearing post we EVALUATED (fit or not) so bad-fit posts
  // don't resurface on the next scan. Posts without an email are left unrecorded —
  // a later comment may add the apply address.
  appendHistory(withEmail.map((p) => ({ url: p.url, query })));

  return {
    posts: result,
    stats: {
      returned: all.length,
      fresh: fresh.length,
      withEmail: withEmail.length,
      fitting: fitting.length,
      surfaced: result.length,
      page: startPage,
    },
  };
}
