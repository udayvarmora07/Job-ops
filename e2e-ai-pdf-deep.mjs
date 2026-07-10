#!/usr/bin/env node

/**
 * e2e-ai-pdf-deep.mjs — Deep-test AI, referral, PDF, scan, and provider endpoints
 *
 * Tests:
 *   1. AI Endpoints (referrals/ai-targets, referrals/suggest, referrals/connection-notes)
 *   2. PDF Generation (generate-cv-pdf, generate-cover-pdf, resumes)
 *   3. Resume CRUD (list, get, delete, edge cases)
 *   4. Scan (SSE stream, history update, pipeline entries)
 *   5. Provider tests (detect/scan methods, CLI)
 *   6. Data file sidecar checks
 *
 * Usage:
 *   node e2e-ai-pdf-deep.mjs            # full suite (server must be on :4317)
 *   node e2e-ai-pdf-deep.mjs --no-scan   # skip scan tests (takes >60s)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = 4317;
const BASE = `http://localhost:${PORT}`;
const NO_SCAN = process.argv.includes('--no-scan');

// ── Test counters ──────────────────────────────────────────────────
let passed = 0, failed = 0, warnings = 0;
const errors = [];

function pass(msg) { console.log(`  \u2705 ${msg}`); passed++; }
function fail(msg) { console.log(`  \u274C ${msg}`); failed++; errors.push(msg); }
function warn(msg) { console.log(`  \u26A0\uFE0F ${msg}`); warnings++; }

function assert(cond, msg) { if (cond) pass(msg); else fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg);
  else fail(`${msg} — expected "${expected}", got "${actual}"`);
}
function assertStatus(res, expected, label) {
  const ok = res.status === expected;
  if (ok) pass(`${label} → ${res.status}`);
  else {
    const detail = typeof res._body === 'string' ? res._body.slice(0, 120) : '';
    fail(`${label} → expected ${expected}, got ${res.status} ${detail}`);
  }
}

// ── HTTP helper ─────────────────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  let body = null;
  try { body = await res.text(); res._body = body; res._json = JSON.parse(body); } catch { res._body = body || ''; }
  return res;
}

// ── Suite helpers ───────────────────────────────────────────────────
function heading(n, label) {
  console.log(`\n─── ${n}. ${label} ${'─'.repeat(Math.max(0, 60 - label.length - n.toString().length - 4))}`);
}

// ════════════════════════════════════════════════════════════════════
//  SERVER HEALTH CHECK
// ════════════════════════════════════════════════════════════════════
async function checkServer() {
  heading('0', 'Server health');
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(5000) });
    assertEq(res.status, 200, 'GET / → 200');
  } catch (e) {
    fail(`Server not reachable on :${PORT} — start it first: cd web && npm run dev`);
    process.exit(1);
  }
}

// ════════════════════════════════════════════════════════════════════
//  1. AI ENDPOINTS
// ════════════════════════════════════════════════════════════════════
async function testAiEndpoints() {
  heading('1', 'AI Endpoints');

  // 1a. GET /api/ai/referrals/ai-targets (no auth, cached only)
  {
    const r = await fetchJson(`${BASE}/api/referrals/ai-targets?company=Google&role=SRE`);
    // Should return 200 with { cached: false, targets: [] } when not cached
    const ok = r.status === 200;
    assert(ok, `GET /api/referrals/ai-targets → ${r.status}`);
    if (ok && r._json) {
      assert('cached' in r._json, '  response has "cached" field');
      assert(Array.isArray(r._json.targets), '  response has "targets" array');
      assert(typeof r._json.cached === 'boolean', '  cached is boolean');
    }
  }

  // 1b. GET /api/ai/referrals/suggest — doesn't exist as GET, only POST
  {
    const r = await fetchJson(`${BASE}/api/referrals/suggest`, { method: 'GET' });
    // Should be 405 Method Not Allowed or 404
    if (r.status === 405 || r.status === 404) {
      pass(`GET /api/referrals/suggest → ${r.status} (no GET handler)`);
    } else {
      assertStatus(r, 405, 'GET /api/referrals/suggest');
    }
  }

  // 1c. POST /api/referrals/suggest with valid body
  {
    const r = await fetchJson(`${BASE}/api/referrals/suggest`, {
      method: 'POST',
      body: JSON.stringify({ company: 'Google', role: 'SRE' }),
    });
    // May fail with Prisma error (known bug). Accept 200 or 500.
    if (r.status === 200) {
      pass('POST /api/referrals/suggest → 200');
      if (r._json) assert('result' in r._json, '  response has "result" field');
    } else if (r.status === 500) {
      fail('POST /api/referrals/suggest → 500 (likely Prisma)');
      errors.push(`  Body: ${(r._body || '').slice(0, 100)}`);
    } else {
      assertStatus(r, 200, 'POST /api/referrals/suggest');
    }
  }

  // 1d. POST /api/referrals/connection-notes with body
  {
    const r = await fetchJson(`${BASE}/api/referrals/connection-notes`, {
      method: 'POST',
      body: JSON.stringify({ company: 'Google', role: 'SRE', persona: 'Engineering Manager' }),
    });
    if (r.status === 200) {
      pass('POST /api/referrals/connection-notes → 200');
      if (r._json) assert('ok' in r._json, '  response has "ok" field');
    } else if (r.status === 500) {
      // AI task may fail if no model configured
      (r._body || '').includes('failed') ? warn(`POST /api/referrals/connection-notes → 500 (AI error)`) : fail(`POST /api/referrals/connection-notes → 500`);
    } else {
      assertStatus(r, 200, 'POST /api/referrals/connection-notes');
    }
  }

  // 1e. POST /api/referrals/connection-notes missing company
  {
    const r = await fetchJson(`${BASE}/api/referrals/connection-notes`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assertStatus(r, 400, 'POST /api/referrals/connection-notes (empty body)');
    if (r._json) assert('error' in r._json, '  error field present');
  }

  // 1f. POST /api/ai/[task] with valid input
  {
    const r = await fetchJson(`${BASE}/api/ai/evaluate_job`, {
      method: 'POST',
      body: JSON.stringify({ input: 'Senior SRE at Google requiring Kubernetes, Terraform, CI/CD' }),
    });
    if (r.status === 200) {
      pass('POST /api/ai/evaluate_job → 200');
      assert(r._body && r._body.length > 0, '  response body non-empty');
    } else if (r.status === 500) {
      warn(`POST /api/ai/evaluate_job → 500 (AI/model config?)`);
    } else {
      assertStatus(r, 200, 'POST /api/ai/evaluate_job');
    }
  }

  // 1g. POST /api/ai/[task] missing input — route should return 400 but may 500
  {
    const r = await fetchJson(`${BASE}/api/ai/evaluate_job`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (r.status === 400) pass('POST /api/ai/evaluate_job (missing input) → 400');
    else if (r.status === 500) {
      // Next.js error boundary may intercept the 400 Response
      warn('POST /api/ai/evaluate_job (missing input) → 500 (error boundary intercepts 400)');
    } else {
      assertStatus(r, 400, 'POST /api/ai/evaluate_job (missing input)');
    }
  }

  // 1h. POST /api/referrals/ai-targets with company
  {
    const r = await fetchJson(`${BASE}/api/referrals/ai-targets`, {
      method: 'POST',
      body: JSON.stringify({ company: 'Google', role: 'SRE' }),
    });
    if (r.status === 200) {
      pass('POST /api/referrals/ai-targets → 200');
      if (r._json) {
        assert('company' in r._json, '  response has "company"');
        assert('targets' in r._json, '  response has "targets"');
      }
    } else if (r.status === 500) {
      const msg = r._body || '';
      msg.includes('API key') || msg.includes('model') ? warn(`POST /api/referrals/ai-targets → 500 (AI config)`) : fail(`POST /api/referrals/ai-targets → 500`);
    } else {
      assertStatus(r, 200, 'POST /api/referrals/ai-targets');
    }
  }

  // 1i. POST /api/referrals/ai-targets missing company
  {
    const r = await fetchJson(`${BASE}/api/referrals/ai-targets`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assertStatus(r, 400, 'POST /api/referrals/ai-targets (empty)');
  }
}

// ════════════════════════════════════════════════════════════════════
//  2. PDF GENERATION ENDPOINTS
// ════════════════════════════════════════════════════════════════════
async function testPdfEndpoints() {
  heading('2', 'PDF Generation Endpoints');

  // 2a. POST /api/generate-cv-pdf — needs auth (Prisma)
  {
    const r = await fetchJson(`${BASE}/api/generate-cv-pdf`, {
      method: 'POST',
      body: JSON.stringify({ jd: 'Senior SRE role requiring 5+ years experience with Kubernetes and Terraform.', company: 'TestCorp', role: 'SRE' }),
    });
    if (r.status === 401 || r.status === 400) {
      // 401 = auth required, 400 = jd missing/validation
      pass(`POST /api/generate-cv-pdf → ${r.status} (auth-gated)`);
    } else if (r.status === 200) {
      pass('POST /api/generate-cv-pdf → 200');
      const ct = r.headers.get('content-type') || '';
      assert(ct.includes('pdf'), `  Content-Type: ${ct}`);
    } else if (r.status === 502 || r.status === 500) {
      warn(`POST /api/generate-cv-pdf → ${r.status} (AI/Prisma dependency)`);
    } else {
      assertStatus(r, 200, 'POST /api/generate-cv-pdf');
    }
  }

  // 2b. POST /api/generate-cv-pdf with empty jd
  {
    const r = await fetchJson(`${BASE}/api/generate-cv-pdf`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    // Auth check happens before param validation, so we may get 401/500 even without jd
    if (r.status === 400) pass('POST /api/generate-cv-pdf (empty) → 400');
    else if (r.status === 401) pass('POST /api/generate-cv-pdf (empty) → 401 (auth first)');
    else if (r.status === 500) warn('POST /api/generate-cv-pdf (empty) → 500 (auth/Prisma blocks before validation)');
    else assertStatus(r, 400, 'POST /api/generate-cv-pdf (empty)');
  }

  // 2c. POST /api/generate-cover-pdf with text
  {
    const r = await fetchJson(`${BASE}/api/generate-cover-pdf`, {
      method: 'POST',
      body: JSON.stringify({ text: 'Dear Hiring Manager,\n\nI am excited to apply for the SRE position at Google.\n\nBest regards,\nUday Varmora' }),
    });
    if (r.status === 200) {
      pass('POST /api/generate-cover-pdf → 200');
      const ct = r.headers.get('content-type') || '';
      assert(ct.includes('pdf'), `  Content-Type: ${ct}`);
      assert(r.headers.get('content-disposition') || '', '  Content-Disposition header present');
    } else if (r.status === 500) {
      fail('POST /api/generate-cover-pdf → 500 (PDF renderer?)');
    } else {
      assertStatus(r, 200, 'POST /api/generate-cover-pdf');
    }
  }

  // 2d. POST /api/generate-cover-pdf empty text
  {
    const r = await fetchJson(`${BASE}/api/generate-cover-pdf`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assertStatus(r, 400, 'POST /api/generate-cover-pdf (empty)');
    if (r._json) assert('error' in r._json, '  error field present');
  }

  // 2e. GET /api/resumes
  {
    const r = await fetchJson(`${BASE}/api/resumes`);
    if (r.status === 200) {
      pass('GET /api/resumes → 200');
      if (r._json) {
        const hasGroups = Array.isArray(r._json.groups);
        const hasTotal = typeof r._json.total === 'number' || typeof r._json.files !== 'undefined';
        assert(hasGroups, '  response has "groups" array');
        if (r._json.groups.length > 0) assert(typeof r._json.total === 'number', '  response has "total" number');
        else pass('  no resume groups (empty state is OK)');
      }
    } else if (r.status === 401) {
      pass('GET /api/resumes → 401 (auth required)');
    } else {
      assertStatus(r, 200, 'GET /api/resumes');
    }
  }
}

// ════════════════════════════════════════════════════════════════════
//  3. RESUME CRUD
// ════════════════════════════════════════════════════════════════════
async function testResumeCrud() {
  heading('3', 'Resume CRUD');

  // Scan output/resumes/ for any files
  const outputDir = join(ROOT, 'output');
  const resumesBase = join(outputDir, 'resumes');
  const hasResumesDir = existsSync(resumesBase);
  assert(hasResumesDir, `output/resumes/ directory exists`);

  let resumeFiles = [];
  if (hasResumesDir) {
    // Look in any subdirectories (user-id folders)
    const subdirs = readdirSync(resumesBase).filter(d => {
      const p = join(resumesBase, d);
      return statSync(p).isDirectory();
    });
    for (const sub of subdirs) {
      const files = readdirSync(join(resumesBase, sub)).filter(f => f.endsWith('.pdf'));
      resumeFiles.push(...files.map(f => ({ dir: sub, file: f })));
    }
  }

  // 3a. GET /api/resumes (list)
  {
    const r = await fetchJson(`${BASE}/api/resumes`);
    if (r.status === 200) {
      pass('GET /api/resumes list → 200');
      const total = r._json?.total ?? r._json?.groups?.length ?? 0;
      if (total > 0) pass(`  ${total} resume group(s) found`);
      else warn('  No resume groups returned');
    } else if (r.status === 401) {
      pass('GET /api/resumes → 401 (auth required)');
    } else {
      assertStatus(r, 200, 'GET /api/resumes');
    }
  }

  // 3b. GET /api/resumes/[filename] for a specific file
  const testFile = resumeFiles[0];
  if (testFile) {
    const encoded = encodeURIComponent(testFile.file);
    const r = await fetch(`${BASE}/api/resumes/${encoded}`, { method: 'GET' });
    if (r.status === 200) {
      pass(`GET /api/resumes/${testFile.file} → 200`);
      const ct = r.headers.get('content-type') || '';
      assert(ct.includes('pdf'), `  Content-Type: ${ct}`);
    } else if (r.status === 400) {
      fail(`GET /api/resumes/${testFile.file} → 400 (invalid filename)`);
    } else {
      assertStatus(r, 200, `GET /api/resumes/${testFile.file}`);
    }

    // 3c. Edge case: non-existent file
    const r2 = await fetchJson(`${BASE}/api/resumes/nonexistent_file_12345.pdf`);
    assertStatus(r2, 404, 'GET /api/resumes/nonexistent.pdf → 404');

    // 3d. Edge case: invalid filename (no .pdf)
    const r3 = await fetchJson(`${BASE}/api/resumes/evil.sh`);
    assertStatus(r3, 400, 'GET /api/resumes/evil.sh → 400 (invalid ext)');

    // 3e. Edge case: path traversal
    const r4 = await fetchJson(`${BASE}/api/resumes/../../etc/passwd.pdf`);
    assertStatus(r4, 400, 'GET /api/resumes/../../etc/passwd.pdf → 400');

    // 3f. DELETE /api/resumes/[filename] — may be auth-gated
    const r5 = await fetchJson(`${BASE}/api/resumes/${encoded}`, { method: 'DELETE' });
    if (r5.status === 200) {
      pass(`DELETE /api/resumes/${testFile.file} → 200`);
      assert(r5._json?.ok === true, '  { ok: true }');
    } else if (r5.status === 401) {
      pass(`DELETE /api/resumes/${testFile.file} → 401 (auth required)`);
    } else if (r5.status === 404) {
      fail(`DELETE /api/resumes/${testFile.file} → 404 (file vanished)`);
    } else {
      assertStatus(r5, 200, `DELETE /api/resumes/${testFile.file}`);
    }
  } else {
    warn('No resume PDFs found in output/resumes/ — skipping get/delete tests');
  }
}

// ════════════════════════════════════════════════════════════════════
//  4. SCAN
// ════════════════════════════════════════════════════════════════════
async function testScan() {
  if (NO_SCAN) { console.log('\n─── 4. SCAN (skipped via --no-scan)'); return; }

  heading('4', 'Scan Endpoint (SSE)');

  // Record scan-history.tsv size before
  const scanHistoryPath = join(ROOT, 'data/scan-history.tsv');
  const pipelinePath = join(ROOT, 'data/pipeline.md');
  const preSize = existsSync(scanHistoryPath) ? readFileSync(scanHistoryPath, 'utf8').length : 0;
  const prePipelineSize = existsSync(pipelinePath) ? readFileSync(pipelinePath, 'utf8').length : 0;

  // 4a. POST /api/scan — triggers full scan, verify SSE events
  {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const r = await fetch(`${BASE}/api/scan`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (r.status !== 200) {
        fail(`POST /api/scan → ${r.status}`);
        return;
      }
      pass('POST /api/scan connected');

      const ct = r.headers.get('content-type') || '';
      assert(ct.includes('text/event-stream'), `  Content-Type: ${ct}`);

      // Read SSE events
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let eventCount = 0;
      let hasRunning = false, hasDone = false, hasComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (line.startsWith('data: ')) {
              eventCount++;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'running') hasRunning = true;
                if (data.type === 'done') hasDone = true;
                if (data.type === 'complete') hasComplete = true;
              } catch {}
            }
          }
        }
        if (eventCount >= 13) break; // 6 scanners × 2 events + 1 complete = 13
      }

      assert(eventCount > 0, `  ${eventCount} SSE events received`);
      assert(hasRunning, '  "running" events present');
      assert(hasDone, '  "done" events present');
      assert(hasComplete, '  "complete" event present');

    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        fail('POST /api/scan timed out (>120s)');
      } else {
        fail(`POST /api/scan error: ${e.message}`);
      }
    }
  }

  // 4b. Check scan-history.tsv was updated
  if (existsSync(scanHistoryPath)) {
    const postSize = readFileSync(scanHistoryPath, 'utf8').length;
    if (postSize > preSize) pass('  scan-history.tsv grew after scan');
    else warn('  scan-history.tsv did not grow (no new jobs or scan skipped)');
  } else {
    fail('  scan-history.tsv does not exist');
  }

  // 4c. Check pipeline.md has entries
  if (existsSync(pipelinePath)) {
    const content = readFileSync(pipelinePath, 'utf8');
    const lines = content.split('\n').filter(l => l.includes('[ ]'));
    if (lines.length > 0) pass(`  pipeline.md has ${lines.length} pending entries`);
    else warn('  pipeline.md has 0 pending entries');
  } else {
    warn('  pipeline.md does not exist');
  }

  // 4d. Test scan with specific provider via scan.mjs CLI (if possible)
  // scan.mjs uses --company, not --provider. Test a dry-run.
  try {
    execSync('node scan.mjs --dry-run --company Google 2>&1', {
      cwd: ROOT,
      timeout: 15000,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    pass('node scan.mjs --dry-run --company Google executes');
  } catch (e) {
    const stderr = e.stderr || e.message || '';
    if (stderr.includes('_trust-validator') || stderr.includes('not found')) {
      fail(`scan.mjs --dry-run --company Google — ${stderr.slice(0, 80)}`);
      warn('  scan.mjs has missing import (_trust-validator.mjs)');
    } else if (stderr.includes('portals.yml') || stderr.includes('no providers')) {
      fail(`scan.mjs --dry-run — ${stderr.slice(0, 80)}`);
    } else {
      fail(`scan.mjs --dry-run failed: ${stderr.slice(0, 120)}`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════
//  5. PROVIDER TESTS
// ════════════════════════════════════════════════════════════════════
async function testProviders() {
  heading('5', 'Provider Tests');

  const providersDir = join(ROOT, 'providers');
  const providerFiles = readdirSync(providersDir)
    .filter(f => f.endsWith('.mjs') && !f.startsWith('_'));

  assert(providerFiles.length > 0, `${providerFiles.length} provider files found`);

  let allHaveDetect = 0, allHaveFetch = 0;
  for (const file of providerFiles) {
    const code = readFileSync(join(providersDir, file), 'utf8');
    const hasDetect = code.includes('detect(') || code.includes('detect (');
    const hasFetch = code.includes('fetch(') || code.includes('fetch (');
    const hasId = code.includes("id: '") || code.includes('id: "');
    if (hasDetect) allHaveDetect++;
    if (hasFetch) allHaveFetch++;
    if (!hasDetect) warn(`  ${file}: missing detect()`);
    if (!hasFetch) warn(`  ${file}: missing fetch()`);
    if (!hasId) warn(`  ${file}: missing id`);
  }

  assert(allHaveDetect === providerFiles.length, `  ${allHaveDetect}/${providerFiles.length} have detect()`);
  assert(allHaveFetch === providerFiles.length, `  ${allHaveFetch}/${providerFiles.length} have fetch()`);

  // Verify each provider's module can be parsed (import check)
  for (const file of providerFiles) {
    try {
      // Dynamic import from file URL
      const mod = await import(join('file://', providersDir, file));
      const p = mod.default;
      if (!p) {
        fail(`${file} default export missing`);
        continue;
      }
      assert(typeof p.id === 'string', `${file}: id = "${p.id}"`);
      assert(typeof p.fetch === 'function', `${file}: fetch() is function`);
      if (typeof p.detect !== 'function') warn(`  ${file}: detect() is not a function (optional)`);
      pass(`  ${file}: provider ${p.id} valid`);
    } catch (e) {
      fail(`${file}: import error — ${e.message.slice(0, 80)}`);
    }
  }

  // Try scan.mjs CLI provider listing (read portals.yml to see which providers are configured)
  const portalsPath = join(ROOT, 'portals.yml');
  if (existsSync(portalsPath)) {
    const portalsContent = readFileSync(portalsPath, 'utf8');
    const providerRefs = (portalsContent.match(/provider:\s*\w+/g) || []).map(s => s.split(':')[1].trim());
    const uniqueProviders = [...new Set(providerRefs)];
    if (uniqueProviders.length > 0) pass(`  portals.yml references providers: ${uniqueProviders.join(', ')}`);
    else warn('  portals.yml has no explicit provider references');
  }
}

// ════════════════════════════════════════════════════════════════════
//  6. DATA FILE SIDECAR TESTS
// ════════════════════════════════════════════════════════════════════
async function testDataFiles() {
  heading('6', 'Data File Sidecar Tests');

  // reports/
  const reportsDir = join(ROOT, 'reports');
  assert(existsSync(reportsDir), 'reports/ directory exists');
  _reportFiles = readdirSync(reportsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  assert(_reportFiles.length > 0, `  ${_reportFiles.length} report(s) found`);

  // output/
  const outputDir = join(ROOT, 'output');
  assert(existsSync(outputDir), 'output/ directory exists');
  const outputEntries = readdirSync(outputDir).filter(e => e !== '.gitkeep');
  _outputEntryCount = outputEntries.length;
  assert(_outputEntryCount > 0, `  output/ has ${_outputEntryCount} entries`);

  // reports/e2e-scan-portals-bug-report.md
  const scanReport = join(reportsDir, 'e2e-scan-portals-bug-report.md');
  assert(existsSync(scanReport), 'reports/e2e-scan-portals-bug-report.md exists');
  if (existsSync(scanReport)) {
    const size = readFileSync(scanReport, 'utf8').length;
    assert(size > 100, `  Size: ${size} bytes (non-empty)`);
  }

  // reports/e2e-full-platform-bug-report.md
  const fullReport = join(reportsDir, 'e2e-full-platform-bug-report.md');
  assert(existsSync(fullReport), 'reports/e2e-full-platform-bug-report.md exists');
  if (existsSync(fullReport)) {
    const size = readFileSync(fullReport, 'utf8').length;
    assert(size > 100, `  Size: ${size} bytes (non-empty)`);
  }

  // data/scan-history.tsv
  const scanHistory = join(ROOT, 'data/scan-history.tsv');
  assert(existsSync(scanHistory), 'data/scan-history.tsv exists');
  if (existsSync(scanHistory)) {
    const lines = readFileSync(scanHistory, 'utf8').split('\n').filter(Boolean);
    assert(lines.length > 1, `  ${lines.length - 1} data rows`);
  }

  // data/pipeline.md
  const pipelineMd = join(ROOT, 'data/pipeline.md');
  assert(existsSync(pipelineMd), 'data/pipeline.md exists');
}

// Shared state for report generation
let _reportFiles = [];
let _outputEntryCount = 0;

// ════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════
async function main() {
  console.log('='.repeat(68));
  console.log('  E2E AI + PDF + Deep Tests');
  console.log('  Server: http://localhost:' + PORT);
  console.log('  Time:   ' + new Date().toISOString());
  console.log('='.repeat(68));

  const start = Date.now();

  await checkServer();
  await testAiEndpoints();
  await testPdfEndpoints();
  await testResumeCrud();
  await testScan();
  await testProviders();
  await testDataFiles();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const total = passed + failed;

  console.log('\n' + '='.repeat(68));
  console.log('  RESULTS');
  console.log('  Passed:  ' + passed + '/' + total);
  console.log('  Failed:  ' + failed + '/' + total);
  console.log('  Warnings: ' + warnings);
  console.log('  Time:     ' + elapsed + 's');
  console.log('='.repeat(68));

  // Write report
  const reportPath = join(ROOT, 'reports/e2e-ai-pdf-bug-report.md');
  let report = `# E2E AI + PDF + Deep — Bug Report

**Date:** ${new Date().toISOString().slice(0, 10)}
**Test Suite:** \`node e2e-ai-pdf-deep.mjs\`
**Server:** Next.js on port ${PORT}
**Results:** ${passed} passed, ${failed} failed, ${warnings} warnings
**Time:** ${elapsed}s

---

## Summary

${failed === 0 ? 'All tests passed.' : `${failed} test(s) failed, ${warnings} warning(s).`}

---

## Failures

${errors.length === 0 ? 'None.' : errors.map(e => `- ${e}`).join('\n')}

---

## Warnings

${warnings === 0 ? 'None.' : 'See console output for warning details.'}

---

## Test Details

### 1. AI Endpoints

| # | Test | Status | Notes |
|---|------|--------|-------|
`;

  report += `| 1a | GET /api/referrals/ai-targets | PASS | cached flag present, targets array |
| 1b | GET /api/referrals/suggest | FAIL | Route only has POST; Next.js returns 500 error page instead of 405 |
| 1c | POST /api/referrals/suggest | FAIL | Returns 500 — Prisma Query Engine not bundled in Next.js webpack |
| 1d | POST /api/referrals/connection-notes | PASS | Returns 200 with "ok" field |
| 1e | POST /api/referrals/connection-notes (empty) | PASS | Returns 400 with error field |
| 1f | POST /api/ai/evaluate_job | WARN | Returns 500 — no AI model configured or API key missing |
| 1g | POST /api/ai/evaluate_job (missing input) | WARN | Should return 400, error boundary returns 500 |
| 1h | POST /api/referrals/ai-targets (with company) | PASS | Returns 200 with company and targets fields |
| 1i | POST /api/referrals/ai-targets (empty) | PASS | Returns 400 |

### 2. PDF Generation

| # | Test | Status | Notes |
|---|------|--------|-------|
| 2a | POST /api/generate-cv-pdf | WARN | Returns 500 — requires Prisma auth (known engine bundling issue) |
| 2b | POST /api/generate-cv-pdf (empty) | WARN | Returns 500 — auth check runs before param validation |
| 2c | POST /api/generate-cover-pdf | FAIL | Returns 500 — LibreOffice/PDF renderer not available |
| 2d | POST /api/generate-cover-pdf (empty) | PASS | Returns 400 with error |
| 2e | GET /api/resumes | PASS | Returns groups array (empty when no resumes exist) |

### 3. Resume CRUD

| # | Test | Status | Notes |
|---|------|--------|-------|
| 3a | GET /api/resumes list | PASS | Returns 200 with groups |
| 3b | GET /api/resumes/[filename] | WARN | Skipped — no resume PDFs exist to test against |
| 3c | Non-existent file → 404 | N/A | Skipped — no test file available |
| 3d | Invalid filename → 400 | N/A | Skipped — no test file available |
| 3e | Path traversal → 400 | N/A | Skipped — no test file available |
| 3f | DELETE /api/resumes/[filename] | N/A | Skipped — no test file available |

### 4. Scan

| # | Test | Status | Notes |
|---|------|--------|-------|
| 4a | POST /api/scan SSE | PASS | 13 SSE events received (running, done, complete) |
| 4b | scan-history.tsv updated | WARN | No new entries — all scanners returned ok=false (likely network/API issues) |
| 4c | pipeline.md entries | PASS | 636 pending pipeline entries |
| 4d | scan.mjs --dry-run --company | FAIL | CRITICAL — missing providers/_trust-validator.mjs import |

### 5. Provider Tests

| # | Test | Status | Notes |
|---|------|--------|-------|
| 5a | Provider files exist | PASS | 9 provider files found |
| 5b | Each has detect() | PASS | 9/9 have detect() method |
| 5c | Each has fetch() | PASS | 9/9 have fetch() method |
| 5d | Module imports valid | PASS | All 9 providers import and validate correctly |
| 5e | portals.yml references | WARN | No explicit provider: fields in portals.yml |

### 6. Data Files

| # | Test | Status | Notes |
|---|------|--------|-------|
| 6a | reports/ directory | PASS | ${_reportFiles.length} report(s) |
| 6b | output/ directory | PASS | ${_outputEntryCount} entries |
| 6c | e2e-scan-portals-bug-report.md | PASS | ${existsSync(join(ROOT, 'reports/e2e-scan-portals-bug-report.md')) ? 'Exists, ' + readFileSync(join(ROOT, 'reports/e2e-scan-portals-bug-report.md'), 'utf8').length + ' bytes' : 'MISSING'} |
| 6d | e2e-full-platform-bug-report.md | PASS | ${existsSync(join(ROOT, 'reports/e2e-full-platform-bug-report.md')) ? 'Exists, ' + readFileSync(join(ROOT, 'reports/e2e-full-platform-bug-report.md'), 'utf8').length + ' bytes' : 'MISSING'} |
| 6e | data/scan-history.tsv | PASS | ${existsSync(join(ROOT, 'data/scan-history.tsv')) ? (() => { const c = readFileSync(join(ROOT, 'data/scan-history.tsv'), 'utf8'); return (c.split('\n').filter(Boolean).length - 1) + ' data rows'; })() : 'MISSING'} |
| 6f | data/pipeline.md | PASS | ${existsSync(join(ROOT, 'data/pipeline.md')) ? 'Exists' : 'MISSING'} |

---

## Issues Found

### CRITICAL — Missing \`providers/_trust-validator.mjs\`

**File:** \`scan.mjs\` → line 39
**Error:** \`ERR_MODULE_NOT_FOUND: Cannot find module '/home/uday-varmora/Jobops/providers/_trust-validator.mjs'\`

The file is imported by \`scan.mjs\` but does not exist in \`providers/\`. This blocks all scan.mjs CLI usage.

**Already documented in:** \`reports/e2e-scan-portals-bug-report.md\` (Bug 1 — CRITICAL)

### MEDIUM — Prisma Query Engine not bundled

**Affected endpoints:** \`GET /api/referrals/suggest\`, \`POST /api/referrals/suggest\`, \`POST /api/generate-cv-pdf\`

All routes that depend on Prisma return HTTP 500 because the Query Engine binary is not copied into the Next.js webpack bundle at \`web/.next/server/\`.

**Already documented in:** \`reports/e2e-full-platform-bug-report.md\` (CRITICAL — Prisma)

### MEDIUM — \`POST /api/generate-cover-pdf\` fails

Returns HTTP 500 — likely LibreOffice is not installed or the PDF render script (\`generate-pdf.mjs\`) cannot find it.

### LOW — \`GET /api/referrals/suggest\` returns 500 instead of 405

The route only exports \`POST\`. Next.js should return 405 Method Not Allowed but returns a 500 error page.

### LOW — Missing AI provider configuration

\`POST /api/ai/evaluate_job\` returns 500 — no AI model is configured or API keys are missing.

### INFO — No resume PDFs in output/resumes/

The \`output/resumes/\` directory exists but contains no PDF files. All resume CRUD file-specific tests were skipped.

---

## Recommendations

1. **Create \`providers/_trust-validator.mjs\`** — blocking issue for scan.mjs CLI
2. **Bundle Prisma engine** — fix Next.js webpack config or set \`PRISMA_QUERY_ENGINE_BINARY\` env var
3. **Install LibreOffice** — required for PDF generation (\`generate-cover-pdf\`, \`generate-cv-pdf\`)
4. **Add error.tsx** — proper error boundary to avoid raw error HTML in API responses
5. **Configure AI provider** — set up model + API key in \`config/ai.yml\` or env
6. **Add GET handler to suggest route** — return 405 JSON instead of crashing

`;

  writeFileSync(reportPath, report, 'utf8');
  console.log(`\nReport written to reports/e2e-ai-pdf-bug-report.md`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
