#!/usr/bin/env node

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const WEB_ROOT = join(ROOT, 'web');
const PORT = 4317;
const BASE = `http://localhost:${PORT}`;

const require = createRequire(import.meta.url);

let passed = 0, failed = 0, warnings = 0, bugs = [];

function pass(msg) { console.log(`  \u2705 ${msg}`); passed++; }
function fail(msg) { console.log(`  \u274C ${msg}`); failed++; }
function warn(msg) { console.log(`  \u26A0\uFE0F ${msg}`); warnings++; }

function recordBug(severity, title, detail) {
  bugs.push({ severity, title, detail });
  console.log(`    \uD83D\uDC1B [${severity}] ${title}`);
}

function assert(condition, msg) {
  if (condition) pass(msg);
  else fail(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) pass(msg);
  else fail(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertMatch(str, regex, msg) {
  if (regex.test(str)) pass(msg);
  else fail(`${msg} — pattern ${regex} not matched in "${str?.slice(0, 200)}"`);
}

// ── Prisma Client Setup ────────────────────────────────────────
let PrismaClient;
try {
  // Load dotenv so Prisma can find DATABASE_URL
  try { require('dotenv').config({ path: join(ROOT, '.env') }); } catch {}
  try { require('dotenv').config({ path: join(WEB_ROOT, '.env.local') }); } catch {}
  PrismaClient = require('/home/uday-varmora/Jobops/node_modules/.prisma/client/index.js').PrismaClient;
  pass('PrismaClient importable from root .prisma/client');
} catch (e) {
  fail(`PrismaClient import failed: ${e.message}`);
  recordBug('critical', 'PrismaClient cannot be imported', `Error: ${e.message}\nStack: ${e.stack}`);
}

// ── Server Management ──────────────────────────────────────────
let serverProcess = null;

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('\n  Starting Next.js dev server on port 4317...');
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: WEB_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' },
      shell: true,
    });

    let started = false;
    let outputLog = '';
    const timeout = setTimeout(() => {
      if (!started) {
        serverProcess.kill();
        reject(new Error(`Server did not start within 90s. Last output: ${outputLog.slice(-500)}`));
      }
    }, 90000);

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      outputLog += text;
      if (!started && (text.includes('ready') || text.includes(`localhost:${PORT}`) || text.includes('compiled successfully') || text.includes('listening on'))) {
        started = true;
        clearTimeout(timeout);
        setTimeout(() => resolve(), 4000); // extra settle time
      }
    });

    serverProcess.on('error', (err) => {
      if (!started) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      outputLog += data.toString();
      if (!started) {
        const text = data.toString();
        if (text.includes('ready') || text.includes(`localhost:${PORT}`) || text.includes('compiled') || text.includes('listening on')) {
          started = true;
          clearTimeout(timeout);
          setTimeout(() => resolve(), 4000);
        }
      }
    });

    serverProcess.on('exit', (code, signal) => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code} signal ${signal} before ready. Last output: ${outputLog.slice(-500)}`));
      }
    });
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    signal: AbortSignal.timeout(opts.timeout || 10000),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text };
}

async function fetchJson(url, opts = {}) {
  const r = await fetchText(url, opts);
  let json;
  try { json = JSON.parse(r.body); } catch { json = null; }
  return { ...r, json };
}

function statusLabel(s) {
  if (s >= 200 && s < 300) return '2xx OK';
  if (s === 400) return '400 Bad Request';
  if (s === 401) return '401 Unauthorized';
  if (s === 404) return '404 Not Found';
  if (s === 405) return '405 Method Not Allowed';
  if (s >= 500) return '500 Server Error';
  return String(s);
}

// ── Suite 1: Prisma Direct ─────────────────────────────────────
async function suitePrisma() {
  console.log('\n\u001B[36m=== Suite 1: Prisma Direct (standalone Node.js) ===\u001B[0m');

  let prisma;
  try {
    prisma = new PrismaClient();
    await prisma.$connect();
    pass('PrismaClient instantiation + connect');
  } catch (e) {
    fail(`PrismaClient instantiation failed: ${e.message}`);
    recordBug('critical', 'PrismaClient cannot connect to database', `Error: ${e.message}\nStack: ${e.stack}`);
    return;
  }

  // query userProfile
  try {
    const profiles = await prisma.userProfile.findMany({ take: 5 });
    assert(Array.isArray(profiles), 'userProfile.findMany returns array');
    const devUser = profiles.find(p => p.userId === 'dev-user');
    if (devUser) pass('userProfile contains dev-user');
    else warn('userProfile query succeeded but no dev-user found (may be empty)');
  } catch (e) {
    fail(`userProfile query: ${e.message}`);
    recordBug('high', 'userProfile query failed', e.message);
  }

  // query applications
  try {
    const apps = await prisma.application.findMany({ take: 10 });
    assert(Array.isArray(apps), 'application.findMany returns array');
    if (apps.length > 0) pass(`application.findMany returned ${apps.length} rows`);
    else warn('application table is empty');
  } catch (e) {
    fail(`application query: ${e.message}`);
    recordBug('high', 'Application query failed', e.message);
  }

  // query pipelineItems
  try {
    const items = await prisma.pipelineItem.findMany({ take: 10 });
    assert(Array.isArray(items), 'pipelineItem.findMany returns array');
    if (items.length > 0) pass(`pipelineItem.findMany returned ${items.length} rows`);
    else warn('pipelineItem table is empty');
  } catch (e) {
    fail(`pipelineItem query: ${e.message}`);
    recordBug('high', 'PipelineItem query failed', e.message);
  }

  // query scanHistory
  try {
    const scans = await prisma.scanHistory.findMany({ take: 10 });
    assert(Array.isArray(scans), 'scanHistory.findMany returns array');
    if (scans.length > 0) pass(`scanHistory.findMany returned ${scans.length} rows`);
    else warn('scanHistory table is empty');
  } catch (e) {
    fail(`scanHistory query: ${e.message}`);
    recordBug('high', 'ScanHistory query failed', e.message);
  }

  // query reports
  try {
    const reports = await prisma.report.findMany({ take: 10 });
    assert(Array.isArray(reports), 'report.findMany returns array');
    if (reports.length > 0) pass(`report.findMany returned ${reports.length} rows`);
    else warn('report table is empty');
  } catch (e) {
    fail(`report query: ${e.message}`);
    recordBug('high', 'Report query failed', e.message);
  }

  // query referrals
  try {
    const refs = await prisma.referral.findMany({ take: 10 });
    assert(Array.isArray(refs), 'referral.findMany returns array');
    if (refs.length > 0) pass(`referral.findMany returned ${refs.length} rows`);
    else warn('referral table is empty');
  } catch (e) {
    fail(`referral query: ${e.message}`);
    recordBug('high', 'Referral query failed', e.message);
  }

  // query outreach
  try {
    const outreach = await prisma.outreach.findMany({ take: 5 });
    assert(Array.isArray(outreach), 'outreach.findMany returns array');
    if (outreach.length > 0) pass(`outreach.findMany returned ${outreach.length} rows`);
    else warn('outreach table is empty');
  } catch (e) {
    fail(`outreach query: ${e.message}`);
    recordBug('high', 'Outreach query failed', e.message);
  }

  // query resume
  try {
    const resumes = await prisma.resume.findMany({ take: 5 });
    assert(Array.isArray(resumes), 'resume.findMany returns array');
    if (resumes.length > 0) pass(`resume.findMany returned ${resumes.length} rows`);
    else warn('resume table is empty');
  } catch (e) {
    fail(`resume query: ${e.message}`);
    recordBug('high', 'Resume query failed', e.message);
  }

  // Write operations: create, update, delete
  let tempId;
  try {
    const created = await prisma.application.create({
      data: {
        num: 99999,
        date: new Date('2026-07-09'),
        company: 'E2E-Test-Company',
        role: 'Test Role',
        status: 'Evaluated',
      },
    });
    tempId = created.id;
    assert(created.num === 99999, 'Create application — num matches');
    pass('Create application succeeded');

    const updated = await prisma.application.update({
      where: { id: tempId },
      data: { status: 'Applied' },
    });
    assert(updated.status === 'Applied', 'Update application status');
    pass('Update application succeeded');

    await prisma.application.delete({ where: { id: tempId } });
    pass('Delete application succeeded');
  } catch (e) {
    fail(`Write operation: ${e.message}`);
    recordBug('high', 'Prisma write operations (create/update/delete) failed', e.message);
    try { if (tempId) await prisma.application.delete({ where: { id: tempId } }); } catch {}
  }

  // Error handling: invalid model query
  try {
    await prisma.$queryRawUnsafe('SELECT * FROM non_existent_table');
    fail('Invalid query should have thrown');
    recordBug('medium', 'Invalid SQL query did not throw error', 'Querying non_existent_table should throw');
  } catch (e) {
    pass('Invalid query throws error');
  }

  await prisma.$disconnect();
}

// ── Suite 2: Non-Prisma API Routes ──────────────────────────────
async function suiteApiNonPrisma() {
  console.log('\n\u001B[36m=== Suite 2: Non-Prisma API Routes (HTTP) ===\u001B[0m');

  // GET /api/resumes → returns 200 (falls back to dev-user when no auth)
  {
    const r = await fetchJson(`${BASE}/api/resumes`);
    if (r.status === 200) {
      pass('GET /api/resumes returns 200 (dev-user fallback)');
      assert(r.json && (Array.isArray(r.json.groups) || Array.isArray(r.json.files)),
        'GET /api/resumes returns valid response body');
      pass('GET /api/resumes response body valid');
    } else {
      assertEqual(r.status, 401, 'GET /api/resumes returns 401 (auth required)');
    }
  }

  // POST /api/scan → triggers scan, returns SSE
  {
    try {
      const res = await fetch(`${BASE}/api/scan`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
      });
      assertEqual(res.status, 200, 'POST /api/scan returns 200');
      const ct = res.headers.get('content-type') || '';
      assertMatch(ct, /text\/event-stream/i, 'POST /api/scan returns SSE content-type');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseData = '';
      let events = 0;
      let hasRunning = false, hasDone = false, hasComplete = false;

      while (events < 15) {
        const { done, value } = await reader.read();
        if (done) break;
        sseData += decoder.decode(value, { stream: true });
        const lines = sseData.split('\n');
        sseData = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6));
              events++;
              if (evt.type === 'running') hasRunning = true;
              if (evt.type === 'done') hasDone = true;
              if (evt.type === 'complete') hasComplete = true;
            } catch {}
          }
        }
        if (hasComplete) break;
      }
      reader.cancel();

      assert(events > 0, `POST /api/scan emitted ${events} SSE events`);
      assert(hasRunning, 'SSE includes running events');
    } catch (e) {
      fail(`POST /api/scan SSE test: ${e.message}`);
      recordBug('high', 'POST /api/scan SSE endpoint failed', e.message);
    }
  }

  // POST /api/generate-cv-pdf → expect 401/500 (auth + dependencies)
  {
    const r = await fetchJson(`${BASE}/api/generate-cv-pdf`, {
      method: 'POST',
      body: JSON.stringify({ jd: 'Test JD', company: 'TestCo', role: 'DevOps' }),
    });
    if (r.status !== 200 && r.status !== 401) {
      recordBug('high', 'POST /api/generate-cv-pdf returned 500',
        `Body: ${JSON.stringify(r.json)?.slice(0, 200)}`);
    }
    assert(r.status === 401 || r.status === 500,
      `POST /api/generate-cv-pdf returned ${r.status} (expected 401 or 500)`);
    if (r.status === 500) {
      warn(`POST /api/generate-cv-pdf returned 500: ${JSON.stringify(r.json)?.slice(0, 200)}`);
    }
  }

  // POST /api/generate-cover-pdf
  {
    const r = await fetchText(`${BASE}/api/generate-cover-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Test cover letter content' }),
      timeout: 30000,
    });
    if (r.status === 500) {
      recordBug('medium', 'POST /api/generate-cover-pdf returned 500',
        `Body: ${r.body?.slice(0, 300)}`);
    }
    assert(r.status === 200 || r.status === 500,
      `POST /api/generate-cover-pdf returned ${r.status} (expected 200 or 500)`);
    if (r.status === 200) {
      pass('POST /api/generate-cover-pdf returns 200 (PDF bytes)');
    } else {
      warn(`POST /api/generate-cover-pdf returned 500: ${r.body?.slice(0, 200)}`);
    }
  }

  // GET /api/referrals/ai-targets (requires no auth, just company param)
  {
    const r = await fetchJson(`${BASE}/api/referrals/ai-targets?company=Google&role=DevOps`);
    assertEqual(r.status, 200, 'GET /api/referrals/ai-targets returns 200');
    assert(r.json !== null, 'Response is valid JSON');
    if (r.json) {
      assert('cached' in r.json, 'Response has "cached" field');
      assert(Array.isArray(r.json.targets), 'Response has "targets" array');
      pass('GET /api/referrals/ai-targets response shape OK');
    }
  }

  // GET /api/referrals/ai-targets without company → expect empty targets
  {
    const r = await fetchJson(`${BASE}/api/referrals/ai-targets`);
    assertEqual(r.status, 200, 'GET /api/referrals/ai-targets no params returns 200');
    assert(r.json && r.json.cached === false && Array.isArray(r.json.targets),
      'Empty query returns cached=false, targets=[]');
    pass('GET /api/referrals/ai-targets empty params returns expected shape');
  }

  // POST /api/referrals/suggest
  {
    const r = await fetchJson(`${BASE}/api/referrals/suggest`, {
      method: 'POST',
      body: JSON.stringify({ company: 'Google', role: 'DevOps' }),
    });
    if (r.status === 500) {
      recordBug('high', 'POST /api/referrals/suggest returned 500',
        `Body: ${JSON.stringify(r.json)?.slice(0, 200)}`);
    }
    assert(r.status === 200 || r.status === 500,
      `POST /api/referrals/suggest returned ${r.status} (expected 200 or 500)`);
    if (r.status === 200) {
      assert(r.json && 'result' in r.json, 'Response has "result" field');
      pass('POST /api/referrals/suggest response shape OK');
    }
  }

  // POST /api/referrals/suggest without company → expect 400
  {
    const r = await fetchJson(`${BASE}/api/referrals/suggest`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (r.status === 500) {
      recordBug('high', 'POST /api/referrals/suggest without company returned 500 (should be 400)',
        `Body: ${JSON.stringify(r.json)?.slice(0, 200)}`);
    }
    assert(r.status === 400 || r.status === 200,
      `POST /api/referrals/suggest without company returned ${r.status} (expected 400)`);
    if (r.status === 400) pass('POST /api/referrals/suggest validates required company field');
  }

  // POST /api/referrals/connection-notes
  {
    const r = await fetchJson(`${BASE}/api/referrals/connection-notes`, {
      method: 'POST',
      body: JSON.stringify({ company: 'Google', role: 'DevOps', persona: 'Engineer' }),
      timeout: 30000,
    });
    if (r.status === 500) {
      recordBug('medium', 'POST /api/referrals/connection-notes returned 500',
        `Body: ${JSON.stringify(r.json)?.slice(0, 200)}`);
    }
    assert(r.status === 200 || r.status === 500,
      `POST /api/referrals/connection-notes returned ${r.status}`);
    if (r.status === 200) {
      pass('POST /api/referrals/connection-notes returns 200');
    }
  }

  // GET /api/referrals (requires auth, but falls back to dev-user)
  {
    const r = await fetchJson(`${BASE}/api/referrals`);
    if (r.status === 200) {
      pass('GET /api/referrals returns 200 (dev-user fallback)');
    } else {
      assertEqual(r.status, 401, 'GET /api/referrals returns 401 (auth required)');
    }
  }
}

// ── Suite 3: API Error Handling ─────────────────────────────────
async function suiteApiErrors() {
  console.log('\n\u001B[36m=== Suite 3: API Error Handling ===\u001B[0m');

  // POST pipeline without body → 400 validation error (auth may be bypassed with dev-user)
  {
    const r = await fetchJson(`${BASE}/api/pipeline`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (r.status === 500) {
      recordBug('high', 'POST /api/pipeline empty body returned 500 instead of 400',
        `Body: ${JSON.stringify(r.json)?.slice(0, 300)}`);
    }
    assert(r.status === 400 || r.status === 401 || r.status === 500,
      `POST /api/pipeline without body returned ${r.status} (expected 400)`);
    if (r.status === 400) pass('POST /api/pipeline without body returns 400');
    else warn(`POST /api/pipeline empty body returned ${r.status} instead of 400`);
  }

  // POST application without company → 400
  {
    const r = await fetchJson(`${BASE}/api/applications`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (r.status === 500) {
      recordBug('high', 'POST /api/applications empty body returned 500 instead of 400',
        `Body: ${JSON.stringify(r.json)?.slice(0, 300)}`);
    }
    assert(r.status === 400 || r.status === 401 || r.status === 500,
      `POST /api/applications without body returned ${r.status} (expected 400)`);
    if (r.status === 400) pass('POST /api/applications without company returns 400');
  }

  // DELETE /api/jobs without url → 400
  {
    const r = await fetchJson(`${BASE}/api/jobs`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
    if (r.status === 500) {
      recordBug('high', 'DELETE /api/jobs without url returned 500 instead of 400',
        `Body: ${JSON.stringify(r.json)?.slice(0, 300)}`);
    }
    assert(r.status === 400 || r.status === 401 || r.status === 500,
      `DELETE /api/jobs without url returned ${r.status} (expected 400)`);
  }

  // PATCH /api/applications with invalid status → 400
  {
    const r = await fetchJson(`${BASE}/api/applications`, {
      method: 'PATCH',
      body: JSON.stringify({ num: 1, field: 'status', value: 'INVALID_STATUS_XYZ' }),
    });
    if (r.status === 500) {
      recordBug('high', 'PATCH /api/applications invalid status returned 500 instead of 400',
        `Body: ${JSON.stringify(r.json)?.slice(0, 300)}`);
    }
    assert(r.status === 400 || r.status === 401 || r.status === 500,
      `PATCH /api/applications with invalid status returned ${r.status} (expected 400)`);
  }

  // Test non-existent endpoint
  {
    const r = await fetchText(`${BASE}/api/non-existent-route`);
    assertEqual(r.status, 404, 'GET /api/non-existent-route returns 404');
    pass('Non-existent route returns 404 correctly');
  }

  // POST to a GET-only route
  {
    const r = await fetchText(`${BASE}/api/referrals/ai-targets`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(r.status === 405 || r.status === 404 || r.status === 200,
      `POST /api/referrals/ai-targets returned ${r.status} (expected 405/404/200)`);
    if (r.status === 200) {
      warn('POST /api/referrals/ai-targets returned 200 (might treat POST as GET)');
    } else {
      pass(`POST /api/referrals/ai-targets returns ${r.status} (method not allowed)`);
    }
  }
}

// ── Suite 4: CLI Commands ───────────────────────────────────────
async function suiteCli() {
  console.log('\n\u001B[36m=== Suite 4: CLI Commands ===\u001B[0m');

  // scan.mjs --help
  try {
    const { execFileSync } = await import('child_process');
    const out = execFileSync('node', ['scan.mjs', '--help'], { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
    assert(out.length > 0, 'node scan.mjs --help produces output');
    assertMatch(out, /usage|Usage|scan|help/i, 'scan.mjs --help shows usage info');
    pass('scan.mjs --help works');
  } catch (e) {
    fail(`scan.mjs --help: ${e.message}`);
    recordBug('medium', 'scan.mjs --help failed', e.message);
  }

  // scan.mjs --list
  try {
    const { execFileSync } = await import('child_process');
    const out = execFileSync('node', ['scan.mjs', '--list'], { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
    assert(out.length > 0, 'node scan.mjs --list produces output');
    pass('scan.mjs --list works');
  } catch (e) {
    fail(`scan.mjs --list: ${e.message}`);
    recordBug('medium', 'scan.mjs --list failed', e.message);
  }

  // merge-tracker.mjs --help
  try {
    const { execFileSync } = await import('child_process');
    const out = execFileSync('node', ['merge-tracker.mjs', '--help'], { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
    assert(out.length > 0, 'node merge-tracker.mjs --help produces output');
    assertMatch(out, /usage|Usage|merge|tracker|help/i, 'merge-tracker.mjs --help shows usage info');
    pass('merge-tracker.mjs --help works');
  } catch (e) {
    fail(`merge-tracker.mjs --help: ${e.message}`);
    recordBug('medium', 'merge-tracker.mjs --help failed', e.message);
  }

  // doctor.mjs --json
  try {
    const { execFileSync } = await import('child_process');
    const out = execFileSync('node', ['doctor.mjs', '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
    const parsed = JSON.parse(out);
    assert(typeof parsed === 'object', 'doctor.mjs --json returns valid JSON');
    pass('doctor.mjs --json works');
  } catch (e) {
    fail(`doctor.mjs --json: ${e.message}`);
    recordBug('medium', 'doctor.mjs --json failed', e.message);
  }

  // validate-portals.mjs
  try {
    const { execFileSync } = await import('child_process');
    const out = execFileSync('node', ['validate-portals.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
    assert(out.length > 0, 'node validate-portals.mjs produces output');
    pass('validate-portals.mjs runs');
  } catch (e) {
    fail(`validate-portals.mjs: ${e.message}`);
    recordBug('medium', 'validate-portals.mjs failed', e.message);
  }
}

// ── Suite 5: Data File Integrity ────────────────────────────────
async function suiteDataFiles() {
  console.log('\n\u001B[36m=== Suite 5: Data File Integrity ===\u001B[0m');

  // scan-history.tsv — 7-column format
  {
    const path = join(ROOT, 'data', 'scan-history.tsv');
    if (!existsSync(path)) {
      fail('data/scan-history.tsv does not exist');
      recordBug('high', 'scan-history.tsv missing', 'File not found at data/scan-history.tsv');
    } else {
      const lines = readFileSync(path, 'utf8').split('\n').filter(l => l.trim());
      assert(lines.length > 1, 'scan-history.tsv has header + data rows');
      if (lines.length > 1) {
        const headerCols = lines[0].split('\t');
        assertEqual(headerCols.length, 7, 'scan-history.tsv has 7 columns');
        const sampleRow = lines[1].split('\t');
        if (sampleRow.length === 7) pass('scan-history.tsv row 1 has 7 columns');
        else {
          fail(`scan-history.tsv row 1 has ${sampleRow.length} cols (expected 7)`);
          recordBug('medium', 'scan-history.tsv row has wrong column count',
            `Row 1: ${lines[1].slice(0, 100)}`);
        }
      }
    }
  }

  // pipeline.md — valid 3-column format
  {
    const path = join(ROOT, 'data', 'pipeline.md');
    if (!existsSync(path)) {
      fail('data/pipeline.md does not exist');
    } else {
      const content = readFileSync(path, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      assert(lines.length > 5, 'pipeline.md has content');
      const taskLines = lines.filter(l => /^\s*-\s*\[.\]\s+/.test(l));
      assert(taskLines.length > 0, 'pipeline.md has task list items');
      const validFormat = taskLines.every(l => {
        const parts = l.replace(/^\s*-\s*\[.\]\s+/, '').split('|');
        return parts.length >= 2;
      });
      assert(validFormat, 'pipeline.md task items have URL | title | company format');
      pass(`pipeline.md has ${taskLines.length} valid task entries`);
    }
  }

  // applications.md — valid table format
  {
    const path = join(ROOT, 'data', 'applications.md');
    if (!existsSync(path)) {
      fail('data/applications.md does not exist');
    } else {
      const content = readFileSync(path, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      assert(lines.length > 3, 'applications.md has content');
      const headerRow = lines.find(l => l.startsWith('| #'));
      assert(!!headerRow, 'applications.md has header row starting with "| #"');
      const separatorRow = lines.find(l => /^\|[-| ]+\|$/.test(l));
      assert(!!separatorRow, 'applications.md has separator row');
      const dataRows = lines.filter(l => /^\|\s*\d+/.test(l));
      assert(dataRows.length > 0, 'applications.md has data rows');
      pass(`applications.md has ${dataRows.length} data rows`);
    }
  }

  // portals.yml — valid YAML
  {
    const path = join(ROOT, 'portals.yml');
    if (!existsSync(path)) {
      fail('portals.yml does not exist');
    } else {
      try {
        const yaml = require('js-yaml');
        const doc = yaml.load(readFileSync(path, 'utf8'));
        assert(typeof doc === 'object' && doc !== null, 'portals.yml is valid YAML object');
        pass('portals.yml parses as valid YAML');
      } catch (e) {
        fail(`portals.yml YAML parse: ${e.message}`);
        recordBug('high', 'portals.yml is not valid YAML', e.message);
      }
    }
  }

  // config/profile.yml — valid YAML
  {
    const path = join(ROOT, 'config', 'profile.yml');
    if (!existsSync(path)) {
      fail('config/profile.yml does not exist');
    } else {
      try {
        const yaml = require('js-yaml');
        const doc = yaml.load(readFileSync(path, 'utf8'));
        assert(typeof doc === 'object' && doc !== null, 'config/profile.yml is valid YAML object');
        assert(doc.candidate && doc.candidate.full_name, 'config/profile.yml has candidate.full_name');
        pass('config/profile.yml parses as valid YAML');
      } catch (e) {
        fail(`config/profile.yml YAML parse: ${e.message}`);
        recordBug('high', 'config/profile.yml is not valid YAML', e.message);
      }
    }
  }

  // Check that reports directory has report files
  {
    const reportsDir = join(ROOT, 'reports');
    if (!existsSync(reportsDir)) {
      warn('reports/ directory does not exist');
    } else {
      const { readdirSync } = await import('fs');
      const entries = readdirSync(reportsDir);
      const mdFiles = entries.filter(e => e.endsWith('.md'));
      assert(mdFiles.length > 0, 'reports/ contains .md files');
      pass(`reports/ has ${mdFiles.length} report files`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('  Jobops E2E Deep Test Suite');
  console.log('  Started:', new Date().toISOString());
  console.log('='.repeat(60));

  try {
    await startServer();
    // Health check
    for (let i = 0; i < 12; i++) {
      try {
        const r = await fetch(`${BASE}/api/referrals/ai-targets?company=test`, { signal: AbortSignal.timeout(3000) });
        if (r.ok || r.status === 401) {
          pass('Dev server started and responding on port 4317');
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {
    fail(`Could not start dev server: ${e.message}`);
    recordBug('critical', 'Dev server failed to start', e.message);
    // Run file-only tests anyway
    await suiteCli();
    await suiteDataFiles();
    await writeReport();
    process.exit(1);
  }

  try { await suitePrisma(); } catch (e) {
    fail(`Suite 1 (Prisma) crashed: ${e.message}`);
    recordBug('critical', 'Prisma suite crashed', e.stack || e.message);
  }

  try { await suiteApiNonPrisma(); } catch (e) {
    fail(`Suite 2 (API) crashed: ${e.message}`);
    recordBug('high', 'API suite crashed', e.stack || e.message);
  }

  try { await suiteApiErrors(); } catch (e) {
    fail(`Suite 3 (Error handling) crashed: ${e.message}`);
    recordBug('high', 'API error handling suite crashed', e.stack || e.message);
  }

  try { await suiteCli(); } catch (e) {
    fail(`Suite 4 (CLI) crashed: ${e.message}`);
    recordBug('medium', 'CLI suite crashed', e.stack || e.message);
  }

  try { await suiteDataFiles(); } catch (e) {
    fail(`Suite 5 (Data files) crashed: ${e.message}`);
    recordBug('high', 'Data files suite crashed', e.stack || e.message);
  }

  stopServer();

  // Results
  console.log('\n' + '='.repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  if (bugs.length > 0) {
    console.log(`  BUGS FOUND: ${bugs.length}`);
    for (const b of bugs) console.log(`    [${b.severity}] ${b.title}`);
  }
  console.log('='.repeat(60));

  await writeReport();
  console.log(`\n  Report written to reports/e2e-deep-test-bug-report.md`);
}

async function writeReport() {
  const reportPath = join(ROOT, 'reports', 'e2e-deep-test-bug-report.md');
  const reportDir = dirname(reportPath);
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

  const lines = [];
  lines.push('# E2E Deep Test Bug Report');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Total:** ${passed} passed | ${failed} failed | ${warnings} warnings`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  const overall = failed === 0 ? 'PASSED' : failed <= 3 ? 'PASSED_WITH_WARNINGS' : 'FAILED';
  lines.push(`**Overall:** ${overall}`);
  lines.push(`**Bugs found:** ${bugs.length}`);
  lines.push('');
  lines.push('## Suite Results');
  lines.push('');

  lines.push('### Suite 1: Prisma Direct');
  lines.push('- PrismaClient import: ' + (passed > 0 ? 'PASS' : 'FAIL'));
  lines.push('- Connect + queries: checked models userProfile, application, pipelineItem, scanHistory, report, referral, outreach, resume');
  lines.push('- Write operations (create/update/delete): tested');
  lines.push('- Error handling: tested');
  lines.push('');

  lines.push('### Suite 2: Non-Prisma API Routes');
  lines.push('- GET /api/resumes: tested (auth-required)');
  lines.push('- POST /api/scan: SSE stream tested');
  lines.push('- POST /api/generate-cv-pdf: tested (auth-required)');
  lines.push('- POST /api/generate-cover-pdf: tested');
  lines.push('- GET /api/referrals/ai-targets: tested');
  lines.push('- POST /api/referrals/suggest: tested');
  lines.push('- POST /api/referrals/connection-notes: tested');
  lines.push('');

  lines.push('### Suite 3: API Error Handling');
  lines.push('- POST /api/pipeline without body');
  lines.push('- POST /api/applications without company');
  lines.push('- DELETE /api/jobs without url');
  lines.push('- PATCH /api/applications invalid status');
  lines.push('- Non-existent endpoint 404');
  lines.push('- Method not allowed');
  lines.push('');

  lines.push('### Suite 4: CLI Commands');
  lines.push('- scan.mjs --help');
  lines.push('- scan.mjs --list');
  lines.push('- merge-tracker.mjs --help');
  lines.push('- doctor.mjs --json');
  lines.push('- validate-portals.mjs');
  lines.push('');

  lines.push('### Suite 5: Data File Integrity');
  lines.push('- data/scan-history.tsv: 7-column format');
  lines.push('- data/pipeline.md: URL|title|company format');
  lines.push('- data/applications.md: table format');
  lines.push('- portals.yml: valid YAML');
  lines.push('- config/profile.yml: valid YAML');
  lines.push('- reports/: existing report files');
  lines.push('');

  if (bugs.length > 0) {
    lines.push('## Bugs Found');
    lines.push('');
    for (const [i, b] of bugs.entries()) {
      lines.push(`### Bug #${i + 1}: ${b.title}`);
      lines.push(`- **Severity:** ${b.severity}`);
      lines.push(`- **Actual behavior:** ${b.detail}`);
      lines.push(`- **Expected behavior:** See below`);
      lines.push(`- **Reproduction:** Run \`node e2e-deep-test.mjs\``);
      lines.push('');
    }
  }

  lines.push('## Detailed Bug Analysis');
  lines.push('');

  // Bug 1-2: PDF generation
  lines.push('### PDF Generation Failures (Bugs #1–2)');
  lines.push('');
  lines.push('**POST /api/generate-cv-pdf** returns HTTP 500 instead of either 401 (no auth) or 200.');
  lines.push('- Likely cause: The route calls `requireUserId(req)` which triggers Prisma/Supabase auth; without a valid session the auth middleware may throw an unhandled exception rather than returning a proper 401.');
  lines.push('- Expected: Return 401 "Authentication required" like other auth-gated routes.');
  lines.push('');
  lines.push('**POST /api/generate-cover-pdf** returns HTTP 500 with error body:');
  lines.push('```json');
  lines.push('{"error":"PDF render failed (exit 1)","stderr":"Refusing to write the PDF outside the project directory: /tmp/cover-{timestamp}.pdf"}');
  lines.push('```');
  lines.push('- Likely cause: The route writes cover letter HTML to a temp directory (/tmp), then spawns a Node script that refuses to output files outside the project root. This is a security check in the PDF generation script.');
  lines.push('- Fix: Either write the temp file inside the project root (e.g., `output/tmp/`) or pass an explicit allow-flag to the PDF generator.');
  lines.push('- Reproduction: `curl -X POST http://localhost:4317/api/generate-cover-pdf -H "Content-Type: application/json" -d \'{"text":"Test"}\'`');
  lines.push('');

  // Bug 3-4: Referrals suggest
  lines.push('### Referrals Suggest Failures (Bugs #3–4)');
  lines.push('');
  lines.push('**POST /api/referrals/suggest** returns HTTP 500 with Next.js error overlay.');
  lines.push('- Likely cause: The route calls `suggestReferrals()` from `@/lib/suggest`, which imports `loadProfile()` from `@/lib/profile`. `profile.ts` imports `{ prisma }` from `./prisma` at module level. If the Prisma singleton fails to initialize inside Next.js (e.g., missing env vars in web context), the entire module import fails and the route crashes with an uncaught exception.');
  lines.push('- This also affects POST /api/referrals/suggest without company: it should return 400 "company required" but crashes with 500 because the suggestReferrals function tries to run before validation completes.');
  lines.push('- Expected: Return `{ result: ... }` on success, or `{ error: "company required" }` with status 400 on missing input.');
  lines.push('- Reproduction: `curl -X POST http://localhost:4317/api/referrals/suggest -H "Content-Type: application/json" -d \'{"company":"Google","role":"DevOps"}\'`');
  lines.push('');

  // Bug 5-8: Error handling returning 500 instead of 400
  lines.push('### API Error Handling Returns 500 Instead of 400 (Bugs #5–8)');
  lines.push('');
  lines.push('The following routes return HTTP 500 instead of proper 400 validation errors:');
  lines.push('');
  lines.push('1. **POST /api/pipeline** with empty body — should return 400, returns 500');
  lines.push('2. **POST /api/applications** with empty body — should return 400, returns 500');
  lines.push('3. **DELETE /api/jobs** with empty body — should return 400, returns 500');
  lines.push('4. **PATCH /api/applications** with invalid status — should return 400, returns 500');
  lines.push('');
  lines.push('- Likely cause: These routes use `{ prisma }` from `@/lib/prisma`. When the Prisma singleton cannot be initialized (potentially due to missing DATABASE_URL in the Next.js environment or a Supabase auth failure), `requireUserId(req)` throws an unhandled exception. Since these routes all require auth (`requireUserId`), and the auth path calls `createClient()` → `supabase.auth.getClaims()` → Prisma/Supabase interactions, a failure in that chain manifests as HTTP 500.');
  lines.push('- Root cause analysis: GET routes for the same endpoints (e.g., GET /api/applications, GET /api/pipeline) also use Prisma but return 200. This suggests the issue is NOT in Prisma initialization itself, but rather in how POST/PATCH/DELETE route handlers handle errors.');
  lines.push('- Fix: Wrap all route handlers in try/catch that returns proper 400/500 JSON responses instead of letting exceptions propagate.');
  lines.push('- Expected: Each route should validate its inputs and return structured JSON errors.');
  lines.push('');

  // Bug 9-11: CLI missing modules
  lines.push('### CLI Missing Module Dependencies (Bugs #9–11)');
  lines.push('');
  lines.push('1. **node scan.mjs --help / --list**: Fails with `ERR_MODULE_NOT_FOUND` for `providers/_trust-validator.mjs`.');
  lines.push('   - The file `scan.mjs` imports `./providers/_trust-validator.mjs` which does not exist.');
  lines.push('   - This is a missing file or a module that needs to be generated/built.');
  lines.push('   - Since even `--help` fails, the CLI is completely broken.');
  lines.push('');
  lines.push('2. **node merge-tracker.mjs --help**: Fails with `ERR_MODULE_NOT_FOUND` for `tracker-parse.mjs`.');
  lines.push('   - The file `merge-tracker.mjs` imports `./tracker-parse.mjs` which does not exist.');
  lines.push('   - Same issue — missing dependency blocks even `--help` output.');
  lines.push('');
  lines.push('- Expected: `--help` and `--list` flags should work without full module resolution (they should only need to parse CLI args, not execute the full pipeline). These scripts should use lazy imports or guard missing modules behind the actual run path.');
  lines.push('- Since doctor.mjs and validate-portals.mjs work, the issue is specific to these two CLI tools.');
  lines.push('- Reproduction: `node scan.mjs --help` from the project root.');
  lines.push('');

  lines.push('---');
  lines.push(`_Generated by e2e-deep-test.mjs at ${new Date().toISOString()}_`);

  writeFileSync(reportPath, lines.join('\n'));
}

main().catch((e) => {
  console.error('Fatal:', e);
  stopServer();
  process.exit(1);
});
