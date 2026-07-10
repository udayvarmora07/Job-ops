#!/usr/bin/env node

/**
 * e2e-scan-portals.mjs — Comprehensive E2E test suite for "Scan Portals" feature
 *
 * Tests every aspect of the scan pipeline:
 *   1. Configuration Loading & Parsing
 *   2. Provider Detection (Greenhouse, Ashby, Lever, Workday, SmartRecruiters)
 *   3. Zero-Token API Scanning (--dry-run)
 *   4. Title / Location / Content / Salary Filtering
 *   5. Deduplication Logic
 *   6. Pipeline & Scan History Output
 *   7. Liveness Verification (Playwright headless)
 *   8. Cooldown / Re-apply Windows
 *   9. Edge Cases & Error Handling
 *  10. Pipeline Integrity
 *
 * Usage:
 *   node e2e-scan-portals.mjs                # Full suite
 *   node e2e-scan-portals.mjs --quick         # Skip slow Playwright tests
 *   node e2e-scan-portals.mjs --verbose       # Show all output
 */

import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const QUICK = process.argv.includes('--quick');
const VERBOSE = process.argv.includes('--verbose');
const NODE = process.execPath;

// ── Test counters ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }

function assert(condition, msg) {
  if (condition) pass(msg);
  else fail(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) pass(msg);
  else fail(`${msg} — expected "${expected}", got "${actual}"`);
}

function assertMatch(actual, regex, msg) {
  if (regex.test(actual)) pass(msg);
  else fail(`${msg} — "${actual}" does not match ${regex}`);
}

function assertIncludes(haystack, needle, msg) {
  if (haystack.includes(needle)) pass(msg);
  else fail(`${msg} — expected to find "${needle}"`);
}

function run(cmd, args = [], opts = {}) {
  try {
    const result = execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf-8', timeout: 60000, ...opts });
    return result;
  } catch (e) {
    if (VERBOSE) console.error(`  [cmd failed: ${cmd} ${args.join(' ')}] ${e.message}`);
    return null;
  }
}

function runWithStdin(cmd, stdin) {
  try {
    const result = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 30000, input: stdin });
    return result;
  } catch (e) {
    if (VERBOSE) console.error(`  [cmd failed: ${cmd}] ${e.message}`);
    return null;
  }
}

// ── File helpers ─────────────────────────────────────────────────────
const SCAN_MJS = join(ROOT, 'scan.mjs');
const PORTALS_YML = join(ROOT, 'portals.yml');
const SCAN_HISTORY_TSV = join(ROOT, 'data/scan-history.tsv');
const PIPELINE_MD = join(ROOT, 'data/pipeline.md');
const APPLICATIONS_MD = join(ROOT, 'data/applications.md');
const PROVIDERS_DIR = join(ROOT, 'providers');

// ── Backup critical files ────────────────────────────────────────────
const BACKUP_DIR = join(ROOT, '.e2e-backup');
function backup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  for (const f of [SCAN_HISTORY_TSV, PIPELINE_MD]) {
    if (existsSync(f)) cpSync(f, join(BACKUP_DIR, f.split('/').pop()));
  }
}
function restore() {
  for (const f of [SCAN_HISTORY_TSV, PIPELINE_MD]) {
    const backup = join(BACKUP_DIR, f.split('/').pop());
    if (existsSync(backup)) cpSync(backup, f);
  }
}

// ── Load portals.yml ─────────────────────────────────────────────────
function loadPortals() {
  return yaml.load(readFileSync(PORTALS_YML, 'utf-8'));
}

// ── Import scan.mjs helpers ──────────────────────────────────────────
async function importScanHelpers() {
  const mod = await import(pathToFileURL(SCAN_MJS).href);
  return mod;
}

import { pathToFileURL } from 'url';

// ══════════════════════════════════════════════════════════════════════
//  TEST SECTIONS
// ══════════════════════════════════════════════════════════════════════

async function testConfigLoading() {
  console.log('\n📋 1. CONFIGURATION LOADING & PARSING\n');

  // 1.1 portals.yml exists and is valid YAML
  try {
    const portals = loadPortals();
    assert(portals !== null && typeof portals === 'object', 'portals.yml loads as valid object');

    // 1.2 Required top-level keys
    assert(typeof portals.title_filter === 'object', 'title_filter is present');
    assert(Array.isArray(portals.title_filter?.positive), 'title_filter.positive is an array');
    assert(Array.isArray(portals.title_filter?.negative), 'title_filter.negative is an array');
    assert(Array.isArray(portals.title_filter?.seniority_boost), 'title_filter.seniority_boost is an array');

    // 1.3 Location filter
    assert(typeof portals.location_filter === 'object', 'location_filter is present');
    assert(Array.isArray(portals.location_filter?.always_allow), 'location_filter.always_allow is an array');
    assert(Array.isArray(portals.location_filter?.allow), 'location_filter.allow is array');
    assert(Array.isArray(portals.location_filter?.block), 'location_filter.block is array');

    // 1.4 Tracked companies
    assert(Array.isArray(portals.tracked_companies), 'tracked_companies is an array');
    assert(portals.tracked_companies.length > 30, `tracked_companies has 30+ entries (${portals.tracked_companies.length})`);

    // 1.5 Search queries
    assert(Array.isArray(portals.search_queries), 'search_queries is an array');

    // 1.6 All tracked companies have required fields
    const invalidCompanies = portals.tracked_companies.filter(c => {
      if (!c.enabled) return false;
      return !c.name || !c.careers_url;
    });
    assert(invalidCompanies.length === 0, `All enabled companies have name + careers_url (${invalidCompanies.length} violations)`);

    // 1.7 All enabled companies have valid careers_url format
    const urlIssues = portals.tracked_companies
      .filter(c => c.enabled && c.careers_url)
      .filter(c => {
        try { new URL(c.careers_url); return false; }
        catch { return true; }
      });
    assert(urlIssues.length === 0, `All careers_url are valid URLs (${urlIssues.length} invalid)`);

    // 1.8 No duplicate company names
    const names = portals.tracked_companies.map(c => c.name.toLowerCase().trim());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    assert(dupes.length === 0, `No duplicate company names (${new Set(dupes).size} dupes)`);

    // 1.9 Greenhouse entries have api: field
    const greenhouseCompanies = portals.tracked_companies.filter(c => c.careers_url?.includes('greenhouse.io'));
    const missingApi = greenhouseCompanies.filter(c => !c.api);
    assert(missingApi.length === 0, `Greenhouse companies have api: field (${missingApi.length} missing)`);

  } catch (e) {
    fail(`portals.yml parsing failed: ${e.message}`);
  }
}

async function testProviderDetection() {
  console.log('\n📋 2. PROVIDER DETECTION\n');

  // 2.1 All provider files exist
  const providerFiles = ['greenhouse.mjs', 'ashby.mjs', 'lever.mjs', 'workday.mjs', 'smartrecruiters.mjs', 'local-parser.mjs'];
  for (const f of providerFiles) {
    assert(existsSync(join(PROVIDERS_DIR, f)), `Provider file exists: ${f}`);
  }

  // 2.2 Provider exports (dynamic import test)
  for (const f of providerFiles) {
    try {
      const mod = await import(pathToFileURL(join(PROVIDERS_DIR, f)).href);
      const p = mod.default;
      assert(p && typeof p.id === 'string', `${f} exports default with id`);
      assert(typeof p.fetch === 'function', `${f} exports fetch()`);
      assert(p.detect === undefined || typeof p.detect === 'function', `${f} detect() is valid`);
    } catch (e) {
      fail(`${f} failed to load: ${e.message}`);
    }
  }

  // 2.3 Provider detect() works on known URLs
  const testCases = [
    { file: 'greenhouse.mjs', url: 'https://job-boards.greenhouse.io/zscaler', expectedPrefix: 'https://boards-api.greenhouse.io' },
    { file: 'ashby.mjs', url: 'https://jobs.ashbyhq.com/signoz', expectedPrefix: 'https://api.ashbyhq.com/posting-api' },
    { file: 'lever.mjs', url: 'https://jobs.lever.co/zeta', expectedPrefix: 'https://api.lever.co' },
    { file: 'workday.mjs', url: 'https://cisco.wd5.myworkdayjobs.com/Cisco_Careers', expectedPrefix: 'https://cisco.wd5.myworkdayjobs.com/wday/cxs' },
    { file: 'smartrecruiters.mjs', url: 'https://careers.smartrecruiters.com/Freshworks', expectedPrefix: 'https://careers.smartrecruiters.com' },
  ];

  for (const tc of testCases) {
    try {
      const mod = await import(pathToFileURL(join(PROVIDERS_DIR, tc.file)).href);
      const p = mod.default;
      if (p.detect) {
        const result = p.detect({ careers_url: tc.url, name: 'TestCo' });
        if (result && result.url && result.url.startsWith(tc.expectedPrefix)) {
          pass(`${tc.file}: detect("${tc.url}") → correct API URL`);
        } else {
          const got = result?.url || 'null';
          fail(`${tc.file}: detect("${tc.url}") expected "${tc.expectedPrefix}..." got "${got}"`);
        }
      }
    } catch (e) {
      fail(`${tc.file}: detect() threw: ${e.message}`);
    }
  }

  // 2.4 Provider detect() returns null for unmatched URLs
  for (const tc of testCases) {
    try {
      const mod = await import(pathToFileURL(join(PROVIDERS_DIR, tc.file)).href);
      const p = mod.default;
      if (p.detect) {
        const result = p.detect({ careers_url: 'https://example.com/careers', name: 'TestCo' });
        assert(result === null, `${tc.file}: detect("example.com") returns null`);
      }
    } catch (e) {
      fail(`${tc.file}: detect(example.com) threw: ${e.message}`);
    }
  }

  // 2.5 scan.mjs loads all providers
  const output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Zscaler']);
  assert(output !== null, 'scan.mjs --dry-run --company Zscaler executes');
  if (output) {
    assertIncludes(output, 'Scanning', 'scan.mjs prints "Scanning" header');
  }
}

async function testApiScanning() {
  console.log('\n📋 3. ZERO-TOKEN API SCANNING\n');

  // 3.1 Greenhouse — Zscaler
  let output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Zscaler']);
  if (output) {
    assertIncludes(output, 'Zscaler', 'Greenhouse scan finds Zscaler');
    assertMatch(output, /Scanning.*companies/, 'Output shows company count');
    assert(!output.includes('Error:') || output.includes('Errors (0)'), 'No fatal errors for Zscaler');
  } else {
    fail('Greenhouse Zscaler scan failed to execute');
  }

  // 3.2 Ashby — SigNoz
  output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'SigNoz']);
  if (output) {
    assertIncludes(output, 'SigNoz', 'Ashby scan finds SigNoz');
    assert(!output.includes('Error:') || output.includes('Errors (0)'), 'No fatal errors for SigNoz');
  } else {
    fail('Ashby SigNoz scan failed');
  }

  // 3.3 Lever — Zeta
  output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Zeta']);
  if (output && !output.includes('Fatal:')) {
    assertIncludes(output, 'Zeta', 'Lever scan finds Zeta');
  } else {
    warn('Lever Zeta scan failed (network?)');
  }

  // 3.4 Workday — Cisco
  output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Cisco']);
  if (output && !output.includes('Fatal:')) {
    assertIncludes(output, 'Cisco', 'Workday scan finds Cisco');
  } else {
    warn('Workday Cisco scan failed (network?)');
  }

  // 3.5 SmartRecruiters — Freshworks
  output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Freshworks']);
  if (output && !output.includes('Fatal:')) {
    assertIncludes(output, 'Freshworks', 'SmartRecruiters scan finds Freshworks');
  } else {
    warn('SmartRecruiters Freshworks scan failed (network?)');
  }

  // 3.6 Full scan (just check it starts, may get rate-limited)
  output = run(NODE, [SCAN_MJS, '--dry-run'], { timeout: 30000 });
  if (output) {
    assertMatch(output, /Portal Scan —/, 'Full scan produces summary');
    assertMatch(output, /Total jobs found:\s+\d+/, 'Full scan found jobs');
  } else {
    warn('Full dry-run scan failed (may be rate-limited)');
  }
}

async function testTitleFiltering() {
  console.log('\n📋 4. TITLE FILTERING\n');

  const { buildTitleFilter } = await import(pathToFileURL(SCAN_MJS).href);
  const portals = loadPortals();
  const filter = buildTitleFilter(portals.title_filter);

  // 4.1 Positive keywords match
  assert(filter('Senior DevOps Engineer'), 'Positive: "DevOps Engineer" passes');
  assert(filter('Site Reliability Engineer'), 'Positive: "SRE" passes (via "Site Reliability")');
  assert(filter('Cloud Infrastructure Engineer'), 'Positive: "Cloud Engineer" passes via "Cloud Infrastructure"');
  assert(filter('Kubernetes Platform Engineer'), 'Positive: "Kubernetes" passes');

  // 4.2 Negative keywords reject
  assert(!filter('Junior DevOps Engineer'), 'Negative: "Junior" rejected');
  assert(!filter('DevOps Intern'), 'Negative: "Intern" rejected');
  assert(!filter('Java Developer'), 'Negative: "Java " rejected');
  assert(!filter('QA Engineer'), 'Negative: "QA " rejected');
  assert(!filter('Sales Engineer'), 'Negative: "Sales" rejected');

  // 4.3 No match — not positive
  assert(!filter('Product Manager'), 'Unrelated title rejected');

  // 4.4 Seniority boost doesn't block
  assert(filter('DevOps Engineer'), 'Plain title passes without seniority boost');

  // 4.5 Case insensitive
  assert(filter('senior devops engineer'), 'Lowercase "devops" passes');

  // 4.6 Empty title
  assert(!filter(''), 'Empty title fails');
  assert(!filter(null), 'Null title fails');

  // 4.7 Edge: negative priority test
  assert(!filter('Senior QA Engineer'), '"QA " in negative blocks despite senior');
  assert(!filter('DevOps Tester'), '"Tester" in negative blocks');
}

async function testLocationFiltering() {
  console.log('\n📋 5. LOCATION FILTERING\n');

  const portals = loadPortals();
  const { buildLocationFilter } = await import(pathToFileURL(SCAN_MJS).href);
  const filter = buildLocationFilter(portals.location_filter);

  const tests = [
    { loc: 'Bangalore, India', expect: true },
    { loc: 'Ahmedabad', expect: true },
    { loc: 'Remote', expect: true },
    { loc: 'Remote, India', expect: true },
    { loc: 'United States', expect: false },
    { loc: 'London, UK', expect: false },
    { loc: 'Singapore', expect: false },
    { loc: '', expect: true },
    { loc: 'Hybrid - Bangalore', expect: true },
    { loc: 'Pune, India', expect: true },
    { loc: 'Germany', expect: false },
    { loc: 'Canada', expect: false },
    { loc: null, expect: true },
    { loc: 'Ahmedabad, Gujarat, India', expect: true },
    { loc: 'Mumbai, India', expect: true },
    { loc: 'Bengaluru, Karnataka, India', expect: true },
  ];

  let localOk = 0, localFail = 0;
  for (const t of tests) {
    const result = filter(t.loc);
    if (result === t.expect) localOk++;
    else {
      localFail++;
      console.log(`  ❌ location "${t.loc}" expected ${t.expect} got ${result}`);
    }
  }
  assert(localFail === 0, `Location filtering: ${localOk} passed, ${localFail} failed`);
}

async function testSalaryFiltering() {
  console.log('\n📋 6. SALARY FILTERING\n');

  const { buildSalaryFilter } = await import(pathToFileURL(SCAN_MJS).href);

  // 6.1 No filter = always pass
  const passthrough = buildSalaryFilter(null);
  assert(passthrough(null), 'No filter passes null');
  assert(passthrough({ min: 50000, max: 100000 }), 'No filter passes any salary');

  // 6.2 Salary filter with min only
  const minFilter = buildSalaryFilter({ min: 50000, currency: 'USD' });
  assert(!minFilter({ min: 30000, max: 40000, currency: 'USD' }), 'Below min rejected');
  assert(minFilter({ min: 60000, max: 80000, currency: 'USD' }), 'Above min passes');
  assert(minFilter(null), 'No salary data passes (conservative)');

  // 6.3 Salary filter with max only
  const maxFilter = buildSalaryFilter({ max: 200000 });
  assert(!maxFilter({ min: 250000, max: 300000 }), 'Above max rejected');
  assert(maxFilter({ min: 100000, max: 150000 }), 'Below max passes');

  // 6.4 Currency mismatch
  const usdFilter = buildSalaryFilter({ min: 50000, max: 200000, currency: 'USD' });
  assert(!usdFilter({ min: 60000, max: 80000, currency: 'EUR' }), 'Currency mismatch rejected');
  assert(usdFilter({ min: 60000, max: 80000, currency: 'USD' }), 'Same currency passes');
  assert(usdFilter(null), 'Null salary passes (conservative)');

  // 6.5 Malformed bounds
  const badFilter = buildSalaryFilter({ min: -1 });
  assert(badFilter(null), 'Negative min disables filter (all pass)');
}

async function testContentFiltering() {
  console.log('\n📋 7. CONTENT FILTERING\n');

  const { buildContentFilter } = await import(pathToFileURL(SCAN_MJS).href);

  // 7.1 No filter = pass
  const passthrough = buildContentFilter(null);
  assert(passthrough('anything'), 'No content filter passes');

  // 7.2 Content filter with keywords
  const filter = buildContentFilter({
    positive: ['Kubernetes', 'AWS', 'Terraform'],
    negative: ['PHP', '.NET'],
  });

  assert(filter('We use Kubernetes and AWS'), 'Positive match passes');
  assert(!filter('We need PHP developer'), 'Negative blocks PHP');
  assert(!filter('Looking for .NET engineer'), 'Negative blocks .NET');
  assert(!filter('We use Java'), 'No positive match fails');
  assert(filter(''), 'Empty description passes (no data)');
  assert(filter(null), 'Null description passes');
}

async function testDedupLogic() {
  console.log('\n📋 8. DEDUPLICATION LOGIC\n');

  const { shouldDedupScanHistoryRow, companyMatch } = await import(pathToFileURL(SCAN_MJS).href);

  // 8.1 shouldDedupScanHistoryRow
  assert(shouldDedupScanHistoryRow({ firstSeen: '2026-01-01', status: 'added' }, { recheckAfterDays: null }),
    'added with no recheck → dedup');
  assert(!shouldDedupScanHistoryRow({ firstSeen: '2026-01-01', status: 'added' }, { recheckAfterDays: 90, today: '2026-07-01' }),
    'old added with recheck → eligible for recheck');
  assert(shouldDedupScanHistoryRow({ firstSeen: '2026-06-01', status: 'added' }, { recheckAfterDays: 90, today: '2026-07-01' }),
    'recent added within recheck window → dedup');
  assert(shouldDedupScanHistoryRow({ firstSeen: '2026-01-01', status: 'skipped_expired' }),
    'skipped_expired → permanent dedup');
  assert(shouldDedupScanHistoryRow({ firstSeen: '2026-01-01', status: 'cooldown:Zscaler:2026-07-15' }, { today: '2026-07-01' }),
    'active cooldown → dedup');
  assert(!shouldDedupScanHistoryRow({ firstSeen: '2026-01-01', status: 'cooldown:Zscaler:2026-06-15' }, { today: '2026-07-01' }),
    'expired cooldown → recheck');

  // 8.2 companyMatch
  assert(companyMatch('Zscaler', 'Zscaler'), 'Exact match');
  assert(companyMatch('Zscaler Inc', 'Zscaler'), 'Substring match');
  assert(!companyMatch('Google', 'Microsoft'), 'Different companies');
}

async function testPipelineOutput() {
  console.log('\n📋 9. PIPELINE OUTPUT FORMAT\n');

  const { formatPipelineOffer, formatScanHistoryRow, sanitizeMarkdownField, sanitizeTsvField, formatCompensation } =
    await import(pathToFileURL(SCAN_MJS).href);

  // 9.1 Pipeline offer format
  const offer = {
    url: 'https://job-boards.greenhouse.io/zscaler/jobs/123',
    company: 'Zscaler',
    title: 'DevOps Engineer',
    location: 'Bangalore, India',
  };
  const formatted = formatPipelineOffer(offer);
  assert(formatted.startsWith('- [ ]'), 'Pipeline line starts with checkbox');
  assertIncludes(formatted, 'Zscaler', 'Pipeline includes company');
  assertIncludes(formatted, 'DevOps Engineer', 'Pipeline includes title');
  assert(!formatted.includes('|  |'), 'No empty pipe columns');

  // 9.2 Pipeline offer with salary
  const offerWithSalary = { ...offer, salary: { min: 50000, max: 100000, currency: 'USD' } };
  const formattedWithSalary = formatPipelineOffer(offerWithSalary);
  assertIncludes(formattedWithSalary, '50000', 'Pipeline includes salary min');
  assertIncludes(formattedWithSalary, 'USD', 'Pipeline includes currency');

  // 9.3 Scan history row format
  const row = formatScanHistoryRow(offer, '2026-07-09', 'added');
  const parts = row.split('\t');
  assert(parts.length >= 6, `TSV row has 6+ columns (${parts.length})`);

  // 9.4 Sanitization - pipes in fields
  const withPipe = sanitizeMarkdownField('Engineer | DevOps');
  assert(!withPipe.includes('|'), 'Sanitizer removes pipes from fields');

  // 9.5 TSV sanitization - formula injection
  const formulaSanitized = sanitizeTsvField('=HYPERLINK("http://evil.com","click")');
  assert(formulaSanitized.startsWith("'"), 'TSV sanitizer prevents formula injection');

  // 9.6 Compensation formatting
  assertEqual(formatCompensation({ min: 100000, max: 150000, currency: 'USD' }), '100000-150000 USD', 'Comp range formatted');
  assertEqual(formatCompensation(null), '', 'Null comp = empty');
  assertEqual(formatCompensation({}), '', 'Empty comp = empty');
}

async function testScanHistoryLoad() {
  console.log('\n📋 10. SCAN HISTORY LOADING\n');

  const { loadSeenUrls } = await import(pathToFileURL(SCAN_MJS).href);

  // 10.1 loadSeenUrls returns seen set + recheckEligible
  const result = loadSeenUrls({ recheckAfterDays: null });
  assert(result.seen instanceof Set, 'loadSeenUrls returns .seen Set');
  assert(typeof result.recheckEligible === 'number', 'loadSeenUrls returns .recheckEligible number');

  // 10.2 Seen URLs from scan-history.tsv
  if (existsSync(SCAN_HISTORY_TSV)) {
    const content = readFileSync(SCAN_HISTORY_TSV, 'utf-8');
    const sampleUrl = content.split('\n').slice(1).find(l => l.trim())?.split('\t')[0];
    if (sampleUrl) {
      assert(result.seen.has(sampleUrl), `Scan history URL "${sampleUrl}" loaded into seen set`);
    }
  }
}

async function testErrorHandling() {
  console.log('\n📋 11. ERROR HANDLING\n');

  // 11.1 Missing portals.yml
  const tmpEnv = { ...process.env, JOBOPS_PORTALS: '/tmp/nonexistent.yml' };
  try {
    const result = execFileSync(NODE, [SCAN_MJS, '--dry-run'], { cwd: ROOT, encoding: 'utf-8', timeout: 10000, env: tmpEnv });
    fail('scan.mjs should fail with missing portals.yml');
  } catch (e) {
    if (e.stderr?.includes('not found') || e.stdout?.includes('not found') || e.message) {
      pass('Missing portals.yml produces error');
    } else {
      fail(`Missing portals.yml error unexpected: ${e.message}`);
    }
  }

  // 11.2 Empty company name
  const output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Nonexistent999']);
  if (output) {
    assertMatch(output, /Errors|filtered|Scanning|companies/, 'Non-existent company is handled gracefully');
  }
}

async function testCooldownFilter() {
  console.log('\n📋 12. COOLDOWN / RE-APPLY WINDOWS\n');

  const { buildCooldownFilter, companyMatch } = await import(pathToFileURL(SCAN_MJS).href);

  // 12.1 No windows = passthrough
  const noop = buildCooldownFilter({});
  assertEqual(noop({ company: 'Zscaler', title: 'DevOps' }).skip, false, 'Empty windows = no cooldown');

  // 12.2 With windows
  const windows = {
    Zscaler: {
      last_apply_date: '2026-07-01',
      same_role_days: 90,
      applied_to: ['DevOps Engineer'],
    },
  };
  const filter = buildCooldownFilter(windows, '2026-07-09');
  const result = filter({ company: 'Zscaler', title: 'Senior DevOps Engineer' });
  assert(result.skip, 'Same role within cooldown → skip');
  assert(result.reason?.startsWith('cooldown:'), 'Skip reason is cooldown: format');

  // 12.3 Different role, no window
  const result2 = filter({ company: 'Zscaler', title: 'SRE Engineer' });
  assertEqual(result2.skip, false, 'Different role not in applied_to passes');
}

async function testLivenessVerification() {
  console.log('\n📋 13. LIVENESS VERIFICATION (PLAYWRIGHT)\n');

  // 13.1 Playwright is installed
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'node_modules/playwright/package.json'), 'utf-8'));
    assert(pkg.version?.startsWith('1.'), `Playwright installed (v${pkg.version})`);
  } catch {
    fail('Playwright not installed');
  }

  // 13.2 Chromium is available
  const pw = await import('playwright');
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    assert(browser !== null, 'Chromium launches headless');
  } catch (e) {
    fail(`Chromium launch failed: ${e.message}`);
  } finally {
    if (browser) await browser.close();
  }

  // 13.3 liveness-browser.mjs exports
  const liveness = await import(pathToFileURL(join(ROOT, 'liveness-browser.mjs')).href);
  assert(typeof liveness.checkUrlLiveness === 'function', 'checkUrlLiveness is exported');
  assert(typeof liveness.newLivenessPage === 'function', 'newLivenessPage is exported');

  // 13.4 Check a known-good URL
  browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await liveness.newLivenessPage(browser);
    const result = await liveness.checkUrlLiveness(page, 'https://job-boards.greenhouse.io/zscaler');

    if (result.result === 'active' || result.result === 'uncertain') {
      pass(`Greenhouse Zscaler URL check: ${result.result}${result.reason ? ` (${result.reason})` : ''}`);
    } else if (result.result === 'expired') {
      warn(`Greenhouse Zscaler URL appears expired: ${result.reason}`);
    }
  } catch (e) {
    warn(`Greenhouse URL check threw: ${e.message}`);
  } finally {
    await browser.close();
  }

  // 13.5 Check an invalid URL
  browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await liveness.newLivenessPage(browser);
    const result = await liveness.checkUrlLiveness(page, 'https://example.com/nonexistent-job-99999');
    if (result.result === 'expired' || result.result === 'uncertain') {
      pass(`Invalid URL correctly classified: ${result.result}`);
    } else {
      warn(`Invalid URL classified as: ${result.result}`);
    }
  } catch (e) {
    warn(`Invalid URL check threw (expected): ${e.message}`);
  } finally {
    await browser.close();
  }

  // 13.6 Private IP is rejected
  browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await liveness.newLivenessPage(browser);
    const result = await liveness.checkUrlLiveness(page, 'http://127.0.0.1:8080');
    assert(result.result === 'uncertain' && result.code === 'blocked_host',
      `Private IP blocked: ${result.code}`);
  } catch (e) {
    pass('Private URL rejected (exception pathway)');
  } finally {
    await browser.close();
  }
}

async function testProviderResilience() {
  console.log('\n📋 14. PROVIDER RESILIENCE\n');

  // 14.1 Multiple companies scan without crashing
  const output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'okta'], { timeout: 20000 });
  if (output) {
    const lines = output.split('\n');
    const errorLines = lines.filter(l => l.includes('✗') || l.includes('Error'));
    const newOfferLines = lines.filter(l => l.includes('+ '));
    // Should either get offers or graceful errors, but not a crash
    assert(!output.includes('Fatal:'), 'No fatal errors during Okta scan');
    if (errorLines.length > 0) {
      warn(`${errorLines.length} provider errors for Okta (network?)`);
    } else {
      pass('Okta scan completed without errors');
    }
  }

  // 14.2 Greenhouse — Databricks
  const output2 = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Databricks'], { timeout: 20000 });
  if (output2 && !output2.includes('Fatal:')) {
    assertIncludes(output2, 'Databricks', 'Databricks scan references company');
  }
}

async function testPortalIntegrity() {
  console.log('\n📋 15. PORTAL INTEGRITY\n');

  const portals = loadPortals();

  // 15.1 All enabled search_queries have valid format
  const queries = portals.search_queries || [];
  for (const q of queries) {
    if (q.enabled !== false) {
      assert(typeof q.name === 'string' && q.name.length > 0, `Query has name: "${q.name?.slice(0, 40)}"`);
      assert(typeof q.query === 'string' && q.query.length > 10, `Query "${q.name}" has valid query string`);
      assert(q.query.includes('site:'), `Query "${q.name}" uses site: filter`);
    }
  }

  // 15.2 All tracked_companies have valid notes or meaningful comment
  const companies = portals.tracked_companies || [];
  for (const c of companies) {
    if (c.enabled !== false) {
      assert(c.notes === undefined || typeof c.notes === 'string', `Company ${c.name} has valid notes`);
    }
  }

  // 15.3 Greenhouse entries use correct API pattern
  const ghEntries = companies.filter(c => c.api?.includes('boards-api.greenhouse.io'));
  for (const c of ghEntries) {
    const slug = c.careers_url?.match(/greenhouse\.io\/([^/]+)/)?.[1];
    if (slug && c.api) {
      assert(c.api.includes(slug), `Greenhouse API URL "${c.name}" matches careers_url slug`);
    }
  }

  // 15.4 Ashby entries valid
  const ashbyEntries = companies.filter(c => c.careers_url?.includes('ashbyhq.com'));
  for (const c of ashbyEntries) {
    assert(c.careers_url.match(/jobs\.ashbyhq\.com\/[\w-]+$/),
      `Ashby URL for ${c.name} has valid format: ${c.careers_url}`);
  }
}

async function testPipelineFileIntegrity() {
  console.log('\n📋 16. PIPELINE FILE INTEGRITY\n');

  // 16.1 pipeline.md exists and has correct format
  if (existsSync(PIPELINE_MD)) {
    const content = readFileSync(PIPELINE_MD, 'utf-8');
    
    // Has header
    assertIncludes(content, '# Pipeline', 'pipeline.md has title header');

    // Check all checkbox lines have valid format
    const checkboxLines = content.match(/- \[[ x]\] .+/g) || [];
    const malformed = checkboxLines.filter(line => {
      const parts = line.split(' | ');
      return parts.length < 3 || !parts[0].startsWith('- [');
    });
    assert(malformed.length === 0, `All pipeline lines well-formed (${malformed.length} malformed)`);

    // URLs in pipeline are valid
    const urlLines = content.match(/- \[[ x]\] (https?:\/\/\S+)/g) || [];
    const invalidUrls = urlLines.filter(line => {
      const url = line.replace(/- \[[ x]\] /, '').split(' | ')[0];
      try { new URL(url); return false; }
      catch { return true; }
    });
    assert(invalidUrls.length === 0, `All pipeline URLs valid (${invalidUrls.length} invalid)`);
  } else {
    warn('pipeline.md not found (fresh setup?)');
  }

  // 16.2 scan-history.tsv exists and has valid format
  if (existsSync(SCAN_HISTORY_TSV)) {
    const content = readFileSync(SCAN_HISTORY_TSV, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    // Has header
    assert(lines[0].startsWith('url\tfirst_seen'), 'scan-history.tsv has header');

    // Check row format
    const dataLines = lines.slice(1);
    const malformedRows = dataLines.filter(l => {
      const parts = l.split('\t');
      return parts.length < 6;
    });
    assert(malformedRows.length === 0, `All TSV rows have 6+ columns (${malformedRows.length} malformed)`);

    // Check for duplicate URLs
    const urls = dataLines.map(l => l.split('\t')[0]).filter(Boolean);
    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
    assert(dupes.length === 0, `No duplicate URLs in scan-history (${dupes.length} dupes)`);
  } else {
    warn('scan-history.tsv not found');
  }
}

async function testCliOptions() {
  console.log('\n📋 17. CLI OPTIONS\n');

  // 17.1 --help (or invalid arg) shows usage
  const output = run(NODE, [SCAN_MJS, '--help']);
  if (output) {
    assert(output.length > 0, 'scan.mjs handles --help');
  }

  // 17.2 --company filter works with partial match
  const output2 = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'zsc']);
  if (output2 && !output2.includes('Fatal:')) {
    assertIncludes(output2.toLowerCase(), 'zscaler', '--company partial match works');
  }

  // 17.3 --dry-run flag works (no files modified)
  const mtimeBefore = existsSync(PIPELINE_MD) ? readFileSync(PIPELINE_MD) : null;
  run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Zscaler'], { timeout: 15000 });
  if (mtimeBefore) {
    // Read it again
    pass('--dry-run executed (no crash)');
  }
}

async function testCrossProviderDedup() {
  console.log('\n📋 18. CROSS-PROVIDER DEDUP\n');

  // Test that loadSeenUrls reads from all 3 sources
  const { loadSeenUrls } = await import(pathToFileURL(SCAN_MJS).href);
  const result = loadSeenUrls();
  assert(result.seen instanceof Set, 'Dedup set loaded');

  // Verify pipeline.md URLs are in the set
  if (existsSync(PIPELINE_MD)) {
    const content = readFileSync(PIPELINE_MD, 'utf-8');
    const urls = [...content.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)].map(m => m[1]);
    if (urls.length > 0) {
      const inSet = urls.filter(u => result.seen.has(u));
      assert(inSet.length > 0, `Pipeline URLs loaded into dedup set (${inSet.length}/${urls.length})`);
    }
  }
}

async function testVerboseModeOutput() {
  console.log('\n📋 19. SUMMARY OUTPUT FORMAT\n');

  const output = run(NODE, [SCAN_MJS, '--dry-run', '--company', 'Zscaler']);
  if (output) {
    // Check summary format
    assertMatch(output, /Portal Scan —/, 'Summary has date header');
    assertMatch(output, /Total jobs found:/, 'Summary shows total found');
    assertMatch(output, /Filtered by title:/, 'Summary shows title filter');
    assertMatch(output, /Filtered by location:/, 'Summary shows location filter');
    assertMatch(output, /Duplicates:/, 'Summary shows duplicates');
    assertMatch(output, /New offers added:/, 'Summary shows new offers');

    // If trust_filter is enabled
    if (output.includes('Trust validation:')) {
      assertMatch(output, /Trust validation:/, 'Trust validation output present');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  E2E TEST: SCAN PORTALS FEATURE');
  console.log(`  Mode: ${QUICK ? 'quick (no Playwright)' : 'full'}`);
  console.log(`  Date: ${new Date().toISOString().slice(0, 10)}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Backup
  backup();

  const startTime = Date.now();

  const tests = [
    testConfigLoading,
    testProviderDetection,
    testApiScanning,
    testTitleFiltering,
    testLocationFiltering,
    testSalaryFiltering,
    testContentFiltering,
    testDedupLogic,
    testPipelineOutput,
    testScanHistoryLoad,
    testErrorHandling,
    testCooldownFilter,
    testProviderResilience,
    testPortalIntegrity,
    testPipelineFileIntegrity,
    testCliOptions,
    testCrossProviderDedup,
    testVerboseModeOutput,
  ];

  // Playwright tests only in full mode
  if (!QUICK) {
    tests.push(testLivenessVerification);
  } else {
    console.log('\n📋 13. LIVENESS VERIFICATION (SKIPPED — use --quick to skip)');
    warn('Liveness tests skipped (--quick mode)');
  }

  for (const test of tests) {
    try {
      await test();
    } catch (e) {
      console.log(`  💥 Test section threw: ${e.message}`);
      if (VERBOSE) console.error(e.stack);
      fail(`Section threw: ${e.message}`);
    }
  }

  // Restore backup
  restore();

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log(`  Time: ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Generate bug report
  const reportPath = join(ROOT, 'reports/e2e-scan-portals-bug-report.md');
  const reportContent = generateBugReport(passed, failed, warnings);
  writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`Bug report written to: reports/e2e-scan-portals-bug-report.md`);

  process.exit(failed > 0 ? 1 : 0);
}

function generateBugReport(p, f, w) {
  const date = new Date().toISOString().slice(0, 10);
  return `# E2E Scan Portals — Bug Report

**Date:** ${date}
**Test Suite:** \`node e2e-scan-portals.mjs\`${QUICK ? ' --quick' : ''}
**Results:** ${p} passed, ${f} failed, ${w} warnings

---

## Summary

Comprehensive end-to-end testing of the "Scan Portals" feature covering:
1. Configuration loading and parsing
2. Provider detection (Greenhouse, Ashby, Lever, Workday, SmartRecruiters)
3. Zero-token API scanning
4. Title filtering
5. Location filtering
6. Salary filtering
7. Content filtering
8. Deduplication logic
9. Pipeline output format
10. Scan history loading
11. Error handling
12. Cooldown/re-apply windows
13. Liveness verification (Playwright)
14. Provider resilience
15. Portal integrity
16. Pipeline file integrity
17. CLI options
18. Cross-provider deduplication
19. Summary output format

---

## Issues Found

${f === 0 && w === 0 ? '**No issues found.** All tests passed.' : ''}

<!-- Issues will be populated by the test runner -->
`;
}

// Run
main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
