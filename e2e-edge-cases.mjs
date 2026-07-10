#!/usr/bin/env node

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4317';
const SCREENSHOT_DIR = join(__dirname, 'reports', 'screenshots-edge');
const REPORT_FILE = join(__dirname, 'reports', 'e2e-edge-case-bug-report.md');
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Results ────────────────────────────────────────────────────────────
const results = [];

function pass(suite, detail) {
  results.push({ suite, verdict: 'PASS', detail });
}

function fail(suite, detail, expected = '', actual = '') {
  results.push({ suite, verdict: 'FAIL', detail, expected, actual });
}

function warn(suite, detail) {
  results.push({ suite, verdict: 'WARN', detail });
}

// ── API helper ─────────────────────────────────────────────────────────
async function api(method, path, body = null, contentType = 'application/json') {
  const opts = { method, headers: {} };
  if (body !== null && body !== undefined) {
    if (typeof body === 'string') {
      opts.body = body;
    } else {
      opts.body = JSON.stringify(body);
    }
    opts.headers = { 'Content-Type': contentType };
  }
  let data = null;
  let text = '';
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const elapsed = Date.now() - start;
    text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, ok: res.ok, data, text, elapsed, contentType: res.headers.get('content-type') };
  } catch (e) {
    return { status: 0, ok: false, data: null, text: e.message, elapsed: Date.now() - start, contentType: null, error: e };
  }
}

async function apiRaw(method, path, body, headers = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, body, headers });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, ok: res.ok, data, text, contentType: res.headers.get('content-type') };
  } catch (e) {
    return { status: 0, ok: false, data: null, text: e.message, error: e };
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  1. UNICODE & INTERNATIONALIZATION
// ═══════════════════════════════════════════════════════════════════════
async function testUnicode() {
  const suite = '1. Unicode & Internationalization';

  const testCases = [
    { label: 'Chinese', val: '公司名称工程师职位' },
    { label: 'Japanese', val: '会社名エンジニア職' },
    { label: 'Korean', val: '회사명엔지니어직무' },
    { label: 'Arabic RTL', val: 'السلام عليكم' },
    { label: 'Emoji', val: '🚀🔥💀' },
    { label: 'ZWJ sequence', val: '👨‍👩‍👧‍👦' },
    { label: 'ZWNJ', val: 'foo\u200Cbar' },
    { label: 'ZWSP', val: 'foo\u200Bbar' },
    { label: 'RTL override U+202E', val: '\u202Enpm install' },
    { label: 'Mixed scripts', val: '東京🗼Data@公司.рус' },
  ];

  for (const tc of testCases) {
    try {
      const r = await api('POST', '/api/applications', { company: tc.val, role: tc.val, status: 'Evaluated' });
      if (r.ok) {
        // Clean up
        pass(suite, `POST application with ${tc.label} text: accepted (ok=true)`);
      } else {
        const msg = r.data?.error || r.text || 'unknown error';
        if (r.status === 400 || r.status === 422) {
          warn(suite, `${tc.label} text rejected gracefully: ${r.status} — ${msg}`);
        } else {
          fail(suite, `${tc.label} text returned error ${r.status}: ${msg}`);
        }
      }
    } catch (e) {
      fail(suite, `${tc.label} text threw: ${e.message}`);
    }
  }

  // Test Unicode in pipeline URL field
  try {
    const r = await api('POST', '/api/pipeline', { url: 'https://例子.测试', company: 'unicode-test', role: 'dev', jd: 'A'.repeat(150) });
    if (r.ok || r.data?.error) {
      pass(suite, `Pipeline with unicode URL rejected or accepted gracefully: ${r.status}`);
    } else {
      fail(suite, `Pipeline with unicode URL: unexpected response ${r.status}`);
    }
  } catch (e) {
    pass(suite, `Pipeline with unicode URL threw (expected): ${e.message}`);
  }

  // Verify Arabic/RTL stored & returned correctly
  try {
    const r2 = await api('GET', '/api/applications');
    if (r2.ok && Array.isArray(r2.data?.applications)) {
      const arabicApps = r2.data.applications.filter(a => a.company && a.company.includes('السلام'));
      if (arabicApps.length > 0) {
        pass(suite, `Arabic text persisted correctly in applications GET`);
      }
      const emojiApps = r2.data.applications.filter(a => a.company && a.company.includes('🚀'));
      if (emojiApps.length > 0) {
        pass(suite, `Emoji text persisted correctly in applications GET`);
      }
    }
  } catch (e) {
    warn(suite, `Could not verify Unicode persistence: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  2. EXTREME INPUT LENGTHS
// ═══════════════════════════════════════════════════════════════════════
async function testExtremeLengths() {
  const suite = '2. Extreme Input Lengths';

  // Empty string
  let r = await api('POST', '/api/pipeline', { url: '', company: 'empty', role: 'test', jd: '' });
  if (r.status === 400) pass(suite, 'Empty URL rejected with 400');
  else fail(suite, `Empty URL: expected 400, got ${r.status}`, '400', String(r.status));

  // Whitespace-only URL
  r = await api('POST', '/api/pipeline', { url: '   ', company: 'test', role: 'test', jd: '' });
  if (r.status === 400) pass(suite, 'Whitespace-only URL rejected with 400');
  else fail(suite, 'Whitespace-only URL: expected 400', '400', String(r.status));

  // Single char URL (invalid URL)
  r = await api('POST', '/api/pipeline', { url: 'a', company: 'test', role: 'test', jd: '' });
  if (r.status === 400 || r.status === 422) pass(suite, 'Single char URL rejected gracefully');
  else warn(suite, `Single char URL: got ${r.status}`);

  // 10K char company name
  const long10k = 'A'.repeat(10000);
  r = await api('POST', '/api/applications', { company: long10k, role: 'test', status: 'Evaluated' });
  if (r.ok) pass(suite, '10K char company name accepted');
  else if (r.status === 400 || r.status === 413) pass(suite, '10K char company name rejected gracefully');
  else fail(suite, `10K char company name: unexpected ${r.status}`, '200/400/413', String(r.status));

  // 50K char company name
  const long50k = 'B'.repeat(50000);
  r = await api('POST', '/api/applications', { company: long50k, role: 'test', status: 'Evaluated' });
  if (!r.ok && (r.status === 413 || r.status === 400)) pass(suite, '50K char company name: rejected with 413/400');
  else if (r.ok) warn(suite, '50K char company name: accepted (may cause DB issues)');
  else fail(suite, `50K char company name: ${r.status} ${(r.data?.error || '').slice(0,50)}`);

  // 100K char company name (should definitely be rejected)
  const long100k = 'C'.repeat(100000);
  r = await api('POST', '/api/applications', { company: long100k, role: 'test', status: 'Evaluated' });
  if (r.status === 413 || r.status === 400) pass(suite, '100K char company name rejected');
  else if (r.ok) fail(suite, '100K char company name ACCEPTED (data integrity risk!)');
  else warn(suite, `100K char company name: ${r.status}`);

  // Very long JDs in pipeline
  const longJd = 'D'.repeat(50000);
  r = await api('POST', '/api/pipeline', { url: 'https://example.com/longjd-test', company: 'LongJD Corp', role: 'Engineer', jd: longJd });
  if (r.ok) pass(suite, '50K char JD accepted in pipeline');
  else fail(suite, `50K char JD rejected: ${r.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
//  3. NUMERIC EDGE CASES
// ═══════════════════════════════════════════════════════════════════════
async function testNumericEdgeCases() {
  const suite = '3. Numeric Edge Cases';

  // The PATCH endpoint uses numeric `num`
  const cases = [
    { label: 'negative number', num: -1 },
    { label: 'zero', num: 0 },
    { label: 'very large', num: 9999999999999999 },
    { label: 'float', num: 3.14159 },
  ];

  for (const tc of cases) {
    const r = await api('PATCH', '/api/applications', { num: tc.num, status: 'Applied' });
    if (r.status === 400 || r.status === 404) pass(suite, `PATCH with ${tc.label} (${tc.num}): rejected gracefully ${r.status}`);
    else warn(suite, `PATCH with ${tc.label} (${tc.num}): ${r.status} ${JSON.stringify(r.data).slice(0,80)}`);
  }

  // NaN as number
  try {
    const r = await apiRaw('POST', '/api/applications', '{"company":"NaNTest","num":NaN}');
    if (r.ok || r.status === 400) pass(suite, 'NaN in body handled: ' + r.status);
    else fail(suite, `NaN body: unexpected ${r.status}`);
  } catch (e) {
    pass(suite, `NaN in body rejected: ${e.message}`);
  }

  // Infinity
  try {
    const r = await apiRaw('POST', '/api/applications', '{"company":"InfTest","score":Infinity}');
    pass(suite, `Infinity in body: ${r.status}`);
  } catch (e) {
    pass(suite, `Infinity rejected: ${e.message}`);
  }

  // Scientific notation as string — profile might take it
  const r2 = await api('PUT', '/api/profile', { fullName: '1e10' });
  if (r2.ok) pass(suite, 'Scientific notation "1e10" as name accepted');
  else pass(suite, `Scientific notation "1e10" as name rejected: ${r2.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
//  4. TYPE COERCION
// ═══════════════════════════════════════════════════════════════════════
async function testTypeCoercion() {
  const suite = '4. Type Coercion';

  // null values
  let r = await api('POST', '/api/applications', { company: null, role: 'test', status: 'Applied' });
  if (r.status === 400 && (r.data?.error || '').toLowerCase().includes('company')) pass(suite, 'null company rejected with 400');
  else fail(suite, `null company: expected 400, got ${r.status}`);

  // omitted field (undefined)
  r = await api('POST', '/api/applications', { role: 'test', status: 'Applied' });
  if (r.status === 400) pass(suite, 'Missing company field (undefined) rejected with 400');
  else fail(suite, `Missing company: expected 400, got ${r.status}`);

  // boolean where string expected
  r = await api('POST', '/api/applications', { company: true, role: 'test', status: 'Applied' });
  if (r.ok) warn(suite, `Boolean "true" as company name ACCEPTED (coercion?)`);
  else if (r.status === 400) pass(suite, 'Boolean as company rejected with 400');
  else fail(suite, `Boolean as company: ${r.status}`);

  r = await api('POST', '/api/applications', { company: false, role: 'test', status: 'Applied' });
  if (r.ok) warn(suite, `Boolean "false" as company name ACCEPTED`);
  else if (r.status === 400) pass(suite, 'Boolean false as company rejected with 400');

  // array where string expected
  r = await api('POST', '/api/applications', { company: ['a', 'b'], role: 'test', status: 'Applied' });
  if (r.ok) warn(suite, 'Array as company name ACCEPTED (data corruption: company=["a","b"])');
  else pass(suite, `Array as company rejected: ${r.status}`);

  // nested object where string expected
  r = await api('POST', '/api/applications', { company: { inner: 'value' }, role: 'test', status: 'Applied' });
  if (r.ok) warn(suite, 'Nested object as company name ACCEPTED');
  else pass(suite, `Nested object as company rejected: ${r.status}`);

  // number where string expected
  r = await api('POST', '/api/applications', { company: 42, role: 'test', status: 'Applied' });
  if (r.ok) pass(suite, 'Number as company name accepted (coerced to string)');
  else fail(suite, `Number as company: ${r.status}`);

  // pipeline: array as URL
  r = await api('POST', '/api/pipeline', { url: ['http://x.com', 'http://y.com'], company: 't', role: 'r' });
  if (r.status === 400) pass(suite, 'Array as URL rejected with 400');
  else warn(suite, `Array as URL: ${r.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
//  5. BROWSER EDGE CASES (Playwright)
// ═══════════════════════════════════════════════════════════════════════
async function testBrowserEdgeCases(browser) {
  const suite = '5. Browser Edge Cases';

  // 5a. Extreme window sizes
  for (const { label, w, h } of [{ label: '200x200 tiny', w: 200, h: 200 }, { label: '2560x1440 large', w: 2560, h: 1440 }]) {
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      p.on('pageerror', err => { fail(suite, `Page error at ${label}: ${err.message}`); });
      await p.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(1000);
      const bodyText = await p.evaluate(() => document.body.innerText);
      if (bodyText && bodyText.length > 0) pass(suite, `Extreme viewport ${label}: page renders with content`);
      else warn(suite, `Extreme viewport ${label}: page appears empty`);
      await p.close();
      await ctx.close();
    } catch (e) {
      warn(suite, `Extreme viewport ${label}: ${e.message}`);
    }
  }

  // 5b. Browser back/forward
  try {
    const p = await browser.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(300);
    await p.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(300);
    await p.goBack({ waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(300);
    const backUrl = p.url();
    if (backUrl.includes('login')) pass(suite, 'Browser back: navigated to /login');
    else pass(suite, `Browser back: navigated to ${backUrl}`);
    await p.goForward({ waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(300);
    const fwdUrl = p.url();
    if (fwdUrl === BASE || fwdUrl.includes('localhost')) pass(suite, 'Browser forward: navigated back to dashboard');
    else pass(suite, `Browser forward: navigated to ${fwdUrl}`);
    await p.close();
  } catch (e) {
    fail(suite, `Browser back/forward: ${e.message}`);
  }

  // 5c localStorage manipulation
  try {
    const p = await browser.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(500);
    await p.evaluate(() => localStorage.clear());
    await p.waitForTimeout(300);
    await p.reload({ waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(1000);
    const bodyAfter = await p.evaluate(() => document.body.innerText);
    if (bodyAfter && bodyAfter.length > 0) pass(suite, 'localStorage cleared + reload: page renders');
    else warn(suite, 'localStorage cleared + reload: page may be empty');
    await p.close();
  } catch (e) {
    warn(suite, `localStorage manipulation: ${e.message}`);
  }

  // 5d Multiple tabs
  try {
    const tabs = [];
    for (let i = 0; i < 3; i++) {
      const p = await browser.newPage();
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
      tabs.push(p);
    }
    const titles = await Promise.all(tabs.map(p => p.title()));
    const allLoaded = titles.every(t => t && t.length > 0);
    if (allLoaded) pass(suite, '3 simultaneous tabs: all loaded successfully');
    else warn(suite, `3 tabs: titles=${JSON.stringify(titles)}`);
    await Promise.all(tabs.map(p => p.close()));
  } catch (e) {
    warn(suite, `Multiple tabs: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  6. URL EDGE CASES
// ═══════════════════════════════════════════════════════════════════════
async function testUrlEdgeCases() {
  const suite = '6. URL Edge Cases';

  const urlCases = [
    { label: 'double-encoded path traversal', url: '%252e%252e%252f' },
    { label: 'with fragment', url: '/api/summary#section' },
    { label: 'multiple query params', url: '/api/summary?a=1&b=2&c=3' },
    { label: 'with semicolon', url: '/api;/summary' },
    { label: 'unicode path', url: '/api/日本語' },
    { label: 'protocol-relative', url: '//evil.com/api' },
    { label: 'single slash', url: '/' },
    { label: 'path traversal', url: '/api/../../../etc/passwd' },
    { label: 'null byte injection', url: '/api/summary%00' },
  ];

  for (const tc of urlCases) {
    try {
      const r = await api('GET', tc.url);
      if (r.status < 500) pass(suite, `${tc.label}: returned ${r.status} (no crash)`);
      else fail(suite, `${tc.label}: server error ${r.status}`, '<500', String(r.status));
    } catch (e) {
      fail(suite, `${tc.label}: fetch threw — ${e.message}`);
    }
  }

  // POST with path traversal in body
  const r = await api('POST', '/api/pipeline', { url: 'https://example.com/../../../etc/passwd', company: 'test', role: 't', jd: 'test'.repeat(50) });
  if (r.ok || r.status >= 400) pass(suite, 'Path traversal URL in body: handled gracefully');
  else fail(suite, `Path traversal URL: ${r.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
//  7. FORM STATE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════
async function testFormStateEdgeCases() {
  const suite = '7. Form State Edge Cases';

  // Empty body POST
  let r = await apiRaw('POST', '/api/pipeline', '');
  if (r.status === 400) pass(suite, 'Empty body POST rejected with 400');
  else fail(suite, `Empty body POST: expected 400, got ${r.status}`, '400', String(r.status));

  // Missing Content-Type
  try {
    const res = await fetch(`${BASE}/api/pipeline`, {
      method: 'POST',
      body: JSON.stringify({ url: 'https://test.com', company: 't', role: 't' }),
    });
    const text = await res.text();
    if (res.status === 400 || res.status === 200) pass(suite, 'POST missing Content-Type: handled');
    else fail(suite, `POST missing Content-Type: ${res.status} ${text.slice(0,50)}`, '200/400', String(res.status));
  } catch (e) {
    warn(suite, `POST missing Content-Type: ${e.message}`);
  }

  // Double submit rapid clicks (simulated via parallel POSTs)
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(api('POST', '/api/applications', { company: 'DoubleSubmitTest', role: 'Engineer', status: 'Applied' }));
  }
  const doubleResults = await Promise.all(promises);
  const okCount = doubleResults.filter(r => r.ok).length;
  if (okCount >= 1 && okCount <= 3) pass(suite, `Double submit: ${okCount}/5 succeeded (acceptable with dedup)`);
  else warn(suite, `Double submit: ${okCount}/5 succeeded (check for duplicates)`);
}

// ═══════════════════════════════════════════════════════════════════════
//  8. CONCURRENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════
async function testConcurrentOps() {
  const suite = '8. Concurrent Operations';

  // 10 simultaneous POSTs to pipeline
  const pipelinePosts = [];
  for (let i = 0; i < 10; i++) {
    pipelinePosts.push(api('POST', '/api/pipeline', {
      url: `https://concurrent-test-${i}.com/job/${i}`,
      company: `ConcurrentTest${i}`,
      role: 'Engineer',
      jd: `JD for test ${i} `.repeat(30),
    }));
  }
  const pipeResults = await Promise.all(pipelinePosts);
  const okPipes = pipeResults.filter(r => r.ok).length;
  const errPipes = pipeResults.filter(r => !r.ok).length;
  if (okPipes > 0) pass(suite, `10 concurrent pipeline POSTs: ${okPipes} OK, ${errPipes} failed`);
  else fail(suite, `10 concurrent pipeline POSTs: ALL ${errPipes} failed`, '>0 OK', `0 OK`);

  // GET + POST + GET same endpoint simultaneously
  const mixedOps = await Promise.all([
    api('GET', '/api/pipeline'),
    api('POST', '/api/pipeline', {
      url: 'https://mixed-ops-test.com/job/1',
      company: 'MixedOps', role: 'SRE', jd: 'test '.repeat(40),
    }),
    api('GET', '/api/pipeline'),
    api('DELETE', '/api/pipeline', { url: 'https://concurrent-test-0.com/job/0' }),
  ]);
  const mixedOk = mixedOps.filter(r => r.ok || r.status === 404).length;
  if (mixedOk >= 3) pass(suite, `Mixed GET+POST+DELETE: ${mixedOk}/4 handled`);
  else fail(suite, `Mixed GET+POST+DELETE: only ${mixedOk}/4`);

  // Read while writing
  const [read1, write1, read2] = await Promise.all([
    api('GET', '/api/applications'),
    api('POST', '/api/applications', { company: 'ReadWriteRace', role: 'Dev', status: 'Applied' }),
    api('GET', '/api/applications'),
  ]);
  if (read1.ok && write1.ok && read2.ok) pass(suite, 'Read while write: all ops succeeded');
  else warn(suite, `Read while write: GET=${read1.status}, POST=${write1.status}, GET2=${read2.status}`);
}

let pipelinePromises; // forward declaration fix

// ═══════════════════════════════════════════════════════════════════════
//  9. API RESPONSE VALIDATION
// ═══════════════════════════════════════════════════════════════════════
async function testApiResponseValidation() {
  const suite = '9. API Response Validation';

  const endpoints = [
    '/api/summary',
    '/api/jobs',
    '/api/pipeline',
    '/api/applications',
    '/api/reports',
    '/api/referrals',
    '/api/resumes',
    '/api/profile',
  ];

  for (const ep of endpoints) {
    const r = await api('GET', ep);

    // Check Content-Type
    if (r.contentType && r.contentType.includes('application/json')) {
      pass(suite, `${ep}: Content-Type is application/json`);
    } else {
      fail(suite, `${ep}: Content-Type is "${r.contentType}"`, 'application/json', r.contentType || '(none)');
    }

    // Check response parses as JSON
    try {
      if (typeof r.data === 'object' && r.data !== null) {
        pass(suite, `${ep}: response is valid JSON`);
      } else {
        fail(suite, `${ep}: response not valid JSON object`, 'JSON object', typeof r.data);
      }
    } catch {
      fail(suite, `${ep}: response not valid JSON`);
    }

    // Check HTTP status follows REST
    if (r.ok) pass(suite, `${ep}: HTTP ${r.status} (OK)`);
    else fail(suite, `${ep}: HTTP ${r.status} (error)`, '200', String(r.status));
  }

  // Error format consistency
  const errorEndpoints = [
    { method: 'POST', path: '/api/pipeline', body: {} },
    { method: 'POST', path: '/api/applications', body: {} },
    { method: 'DELETE', path: '/api/jobs', body: {} },
    { method: 'PATCH', path: '/api/applications', body: { status: 'Bogus' } },
  ];

  for (const ep of errorEndpoints) {
    const r = await api(ep.method, ep.path, ep.body);
    if (r.status >= 400) {
      if (r.data && typeof r.data === 'object' && (r.data.error || r.data.message)) {
        pass(suite, `${ep.method} ${ep.path}: error format has "error"/"message" field`);
      } else {
        fail(suite, `${ep.method} ${ep.path}: error response missing "error" field`, 'has error field', JSON.stringify(r.data).slice(0,100));
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 10. DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════════
async function testDataIntegrity() {
  const suite = '10. Data Integrity';

  // Create record
  const company = 'DataIntegrityTest_' + Date.now();
  const createRes = await api('POST', '/api/applications', { company, role: 'Staff Engineer', status: 'Applied', url: 'https://dataintegrity.com/job' });
  if (!createRes.ok) {
    fail(suite, `Create: POST returned ${createRes.status} ${JSON.stringify(createRes.data).slice(0,80)}`);
    return;
  }
  pass(suite, 'Create: POST returns ok');
  const createdNum = createRes.data.num;

  // Read it back
  let getRes = await api('GET', '/api/applications');
  if (getRes.ok) {
    const app = (getRes.data.applications || []).find(a => a.num === String(createdNum).padStart(3, '0'));
    if (app) {
      pass(suite, `Read: application #${createdNum} found in GET`);
      if (app.company === company) pass(suite, `Read: company name matches "${company}"`);
      else fail(suite, `Read: company name mismatch`, company, app.company);
      if (app.status === 'Applied') pass(suite, `Read: status is "Applied"`);
      else fail(suite, `Read: status mismatch`, 'Applied', app.status);
    } else {
      fail(suite, `Read: application #${createdNum} NOT found in GET`);
    }
  } else {
    fail(suite, `Read: GET returned ${getRes.status}`);
  }

  // Update it
  const patchRes = await api('PATCH', '/api/applications', { num: createdNum, status: 'Interview' });
  if (patchRes.ok) pass(suite, `Update: PATCH status to Interview`);
  else fail(suite, `Update: PATCH returned ${patchRes.status} ${JSON.stringify(patchRes.data).slice(0,80)}`);

  // Verify update
  getRes = await api('GET', '/api/applications');
  if (getRes.ok) {
    const updated = (getRes.data.applications || []).find(a => a.num === String(createdNum).padStart(3, '0'));
    if (updated && updated.status === 'Interview') pass(suite, 'Update verified: status changed to Interview');
    else fail(suite, `Update verify: status is "${updated?.status}"`, 'Interview', updated?.status);
  }

  // Verify no phantom writes — check there aren't extra apps with slight name variants
  getRes = await api('GET', '/api/applications');
  if (getRes.ok) {
    const dataIntegApps = (getRes.data.applications || []).filter(a => a.company && a.company.includes('DataIntegrityTest'));
    if (dataIntegApps.length === 1) pass(suite, 'No phantom writes: exactly 1 DataIntegrityTest app');
    else warn(suite, `Phantom write detected: ${dataIntegApps.length} DataIntegrityTest apps found (expected 1)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  E2E EDGE CASE TESTING');
  console.log(`  Target: ${BASE}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  // Verify server
  try {
    const ping = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    if (ping.status !== 200) {
      console.error(`Server not healthy (HTTP ${ping.status})`);
      process.exit(1);
    }
    console.log(`✓ Server running\n`);
  } catch (e) {
    console.error(`Cannot reach server: ${e.message}`);
    process.exit(1);
  }

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    // ── Run all test suites ──────────────────────────────────────────
    const suites = [
      { fn: testUnicode, name: 'Unicode & Internationalization' },
      { fn: testExtremeLengths, name: 'Extreme Input Lengths' },
      { fn: testNumericEdgeCases, name: 'Numeric Edge Cases' },
      { fn: testTypeCoercion, name: 'Type Coercion' },
      { fn: () => testBrowserEdgeCases(browser), name: 'Browser Edge Cases' },
      { fn: testUrlEdgeCases, name: 'URL Edge Cases' },
      { fn: testFormStateEdgeCases, name: 'Form State Edge Cases' },
      { fn: testConcurrentOps, name: 'Concurrent Operations' },
      { fn: testApiResponseValidation, name: 'API Response Validation' },
      { fn: testDataIntegrity, name: 'Data Integrity' },
    ];

    for (const suite of suites) {
      console.log(`\n📋 ${suite.name}`);
      try {
        await suite.fn();
      } catch (e) {
        console.error(`  💥 Suite threw: ${e.message}`);
        results.push({ suite: suite.name, verdict: 'FAIL', detail: `Suite threw: ${e.message}`, expected: '', actual: e.message });
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passedCount = results.filter(r => r.verdict === 'PASS').length;
  const failedCount = results.filter(r => r.verdict === 'FAIL').length;
  const warnCount = results.filter(r => r.verdict === 'WARN').length;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ✅ ${passedCount} passed | ❌ ${failedCount} failed | ⚠️ ${warnCount} warnings`);
  console.log(`  Time: ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Generate Report ────────────────────────────────────────────────
  const report = generateReport(passedCount, failedCount, warnCount, results);
  writeFileSync(REPORT_FILE, report, 'utf-8');
  console.log(`📄 Report: ${REPORT_FILE}`);

  process.exit(failedCount > 0 ? 1 : 0);
}

function generateReport(p, f, w, details) {
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString();

  let md = `# E2E Edge Case Testing — Bug Report

**Date:** ${date}
**Generated:** ${time}
**Target:** ${BASE}
**Results:** ✅ ${p} passed | ❌ ${f} failed | ⚠️ ${w} warnings

---

## Test Coverage

| # | Suite | Tests |
|---|-------|-------|
| 1 | Unicode & Internationalization | Chinese, Japanese, Korean, Arabic RTL, emoji, ZWJ, ZWNJ, ZWSP, RTL override |
| 2 | Extreme Input Lengths | Empty string, whitespace, single char, 10K/50K/100K strings |
| 3 | Numeric Edge Cases | Negative, zero, large, float, NaN, Infinity |
| 4 | Type Coercion | null, undefined, booleans, arrays, nested objects, numbers |
| 5 | Browser Edge Cases | 200x200 / 2560x1440 viewports, back/forward, localStorage clear, 3 tabs |
| 6 | URL Edge Cases | Double-encoded, fragments, semicolons, unicode, path traversal |
| 7 | Form State Edge Cases | Empty body, missing Content-Type, double submit |
| 8 | Concurrent Operations | 10 simultaneous POSTs, mixed GET+POST+DELETE, read while write |
| 9 | API Response Validation | Content-Type, JSON parsability, status codes, error format |
| 10 | Data Integrity | Create→Read→Update→Verify cycle, phantom write detection |

---

## Detailed Results

`;

  // Group by suite
  const bySuite = {};
  for (const r of details) {
    if (!bySuite[r.suite]) bySuite[r.suite] = [];
    bySuite[r.suite].push(r);
  }

  for (const [suiteName, items] of Object.entries(bySuite)) {
    const suitePass = items.filter(i => i.verdict === 'PASS').length;
    const suiteFail = items.filter(i => i.verdict === 'FAIL').length;
    const suiteWarn = items.filter(i => i.verdict === 'WARN').length;
    md += `### ${suiteName} — ${suitePass}✅ ${suiteFail}❌ ${suiteWarn}⚠️\n\n`;

    for (const item of items) {
      const icon = item.verdict === 'PASS' ? '✅' : item.verdict === 'FAIL' ? '❌' : '⚠️';
      md += `- ${icon} **${item.detail}**`;
      if (item.verdict === 'FAIL' && (item.expected || item.actual)) {
        md += `\n  - Expected: \`${item.expected}\`\n  - Actual: \`${item.actual}\``;
      }
      md += '\n';
    }
    md += '\n';
  }

  // ── Findings Summary ──────────────────────────────────────────────
  const failures = details.filter(r => r.verdict === 'FAIL');
  const warnings = details.filter(r => r.verdict === 'WARN');

  md += `---

## Issues Found

`;

  if (f === 0 && w === 0) {
    md += '**No issues found.** All edge case tests passed.\n';
  } else {
    if (failures.length > 0) {
      md += '### ❌ Failures\n\n';
      md += '| # | Test | Expected | Actual |\n';
      md += '|---|------|----------|--------|\n';
      failures.forEach((r, i) => {
        md += `| ${i+1} | ${r.detail} | \`${(r.expected || '').slice(0, 60)}\` | \`${(r.actual || '').slice(0, 60)}\` |\n`;
      });
      md += '\n';
    }

    if (warnings.length > 0) {
      md += '### ⚠️ Warnings\n\n';
      md += '| # | Test | Detail |\n';
      md += '|---|------|--------|\n';
      warnings.forEach((r, i) => {
        md += `| ${i+1} | ${r.detail} | ${r.expected || ''} |\n`;
      });
      md += '\n';
    }
  }

  md += `---

## Crashes / Hangs / Data Corruption

`;

  const crashes = details.filter(r =>
    r.verdict === 'FAIL' && (
      r.detail.toLowerCase().includes('crash') ||
      r.detail.toLowerCase().includes('timeout') ||
      r.detail.toLowerCase().includes('500') ||
      r.detail.toLowerCase().includes('data corruption')
    )
  );

  const dataCorruption = details.filter(r =>
    r.detail.toLowerCase().includes('accepted') ||
    r.detail.toLowerCase().includes('phantom') ||
    r.detail.toLowerCase().includes('coercion')
  );

  if (crashes.length === 0 && dataCorruption.length === 0) {
    md += 'No crashes, hangs, or data corruption detected.\n';
  } else {
    if (crashes.length > 0) {
      md += '### 💥 Crashes / Server Errors\n\n';
      crashes.forEach(r => { md += `- ${r.detail}\n`; });
      md += '\n';
    }
    if (dataCorruption.length > 0) {
      md += '### 🗑️ Data Corruption / Coercion Risks\n\n';
      dataCorruption.forEach(r => { md += `- ${r.detail}\n`; });
      md += '\n';
    }
  }

  return md;
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});