/**
 * e2e-infra-audit.mjs — Infrastructure, Accessibility & Performance Audit
 * Run: node e2e-infra-audit.mjs
 * Requires: Playwright (installed), server on http://localhost:4317
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:4317';
const ROOT = '/home/uday-varmora/Jobops';

const reportLines = [];
function log(level, section, msg) {
  const line = `| ${level.padEnd(8)} | ${section.padEnd(30)} | ${msg}`;
  reportLines.push(line);
  console.log(line);
}
function heading(text, level = 2) {
  const h = '#'.repeat(level);
  reportLines.push(`\n${h} ${text}`);
  console.log(`\n${h} ${text}`);
}
function code(text) {
  reportLines.push(`\`\`\`\n${text}\n\`\`\``);
}
function table(headers, rows) {
  const line = '| ' + headers.join(' | ') + ' |';
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
  reportLines.push(line);
  reportLines.push(sep);
  console.log(line);
  console.log(sep);
  for (const row of rows) {
    const rLine = '| ' + row.join(' | ') + ' |';
    reportLines.push(rLine);
    console.log(rLine);
  }
}
function text(t) {
  reportLines.push(t);
}

// ─── Helpers ───────────────────────────────────────────────
async function httpGet(urlPath) {
  try {
    const resp = await fetch(`${BASE}${urlPath}`, { redirect: 'manual' });
    return { status: resp.status, headers: resp.headers, body: await resp.text().catch(() => '') };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

function severityColor(s) {
  return s;
}

// ─── 1. Infrastructure Security ───────────────────────────
async function infraSecurity() {
  heading('1. Infrastructure Security');

  const sensitivePaths = [
    '/.env', '/.env.local', '/web/.env.local',
    '/node_modules/', '/node_modules/.package-lock.json',
    '/.git/config', '/.gitignore',
    '/next.config.mjs', '/tsconfig.json',
    '/tailwind.config.ts', '/postcss.config.mjs',
    '/.env.production', '/.env.development',
  ];

  const mapFiles = [];
  text('\n### 1.1 Sensitive file exposure');
  for (const p of sensitivePaths) {
    const r = await httpGet(p);
    const status = r.status;
    const bodyTrunc = (r.body || '').slice(0, 120).replace(/\n/g, '\\n');
    const sev = status === 200 ? 'CRITICAL' : status === 301 || status === 302 ? 'WARNING' : status === 403 ? 'LOW' : 'INFO';
    log(sev, 'Sensitive Path', `${p} → ${status}${r.error ? ' ('+r.error+')' : ''}`);
    if (status === 200 && bodyTrunc) {
      log('EVIDENCE', p, bodyTrunc);
    }
  }

  text('\n### 1.2 Source map exposure');
  // Check Next.js _next/static chunks for .map files
  const staticResp = await httpGet('/_next/static/');
  log('INFO', 'Next static root', staticResp.status === 200 ? 'Exposed' : 'Blocked ('+staticResp.status+')');

  // Walk known chunk paths
  const chunkPaths = ['/_next/static/chunks/', '/_next/static/css/', '/_next/static/media/'];
  for (const cp of chunkPaths) {
    const r = await httpGet(cp);
    if (r.status === 200) {
      log('WARNING', 'Dir listing', `${cp} → accessible`);
      // Check for .map references
      const mapMatches = (r.body || '').match(/\.map\b/g);
      if (mapMatches) {
        log('CRITICAL', 'Source maps', `${cp} contains .map references (${mapMatches.length})`);
      }
    } else {
      log('INFO', 'Dir listing', `${cp} → ${r.status}`);
    }
  }

  text('\n### 1.3 robots.txt & sitemap.xml');
  for (const p of ['/robots.txt', '/sitemap.xml', '/api/robots.txt']) {
    const r = await httpGet(p);
    log(r.status === 200 ? 'INFO' : 'INFO', 'SEO files', `${p} → ${r.status}${r.status === 200 ? ': ' + (r.body || '').slice(0, 200) : ''}`);
  }

  text('\n### 1.4 API directory exposure');
  for (const p of ['/api/', '/api/applications/', '/api/jobs/', '/api/pipeline/']) {
    const r = await httpGet(p);
    log(r.status === 200 ? r.body?.includes('{') ? 'INFO' : 'WARNING' : 'INFO', 'API path', `${p} → ${r.status}`);
  }

  text('\n### 1.5 Directory listing checks');
  for (const p of ['/app/', '/web/', '/data/', '/config/', '/reports/']) {
    const r = await httpGet(p);
    // Next.js might return 404 for non-routes or 200 with page content
    const isDirListing = r.status === 200 && (r.body || '').includes('Index of');
    log(isDirListing ? 'CRITICAL' : 'INFO', 'Dir listing', `${p} → ${r.status}${isDirListing ? ' (DIRECTORY LISTING!)' : ''}`);
  }
}

// ─── 2. Accessibility ─────────────────────────────────────
async function accessibility(browser) {
  heading('2. Accessibility Audit');
  heading('2.1 Page-level checks', 3);

  const pages = [
    { url: '/', name: 'Home' },
    { url: '/login', name: 'Login' },
    { url: '/signup', name: 'Signup' },
    { url: '/forgot-password', name: 'Forgot Password' },
    { url: '/onboarding', name: 'Onboarding' },
    { url: '/settings', name: 'Settings' },
  ];

  const wcagResults = [];

  for (const pageDef of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    heading(`Page: ${pageDef.name} (${pageDef.url})`, 4);

    try {
      await page.goto(`${BASE}${pageDef.url}`, { waitUntil: 'load', timeout: 20000 });
    } catch (e) {
      log('ERROR', 'Navigation', `Failed to load ${pageDef.url}: ${e.message}`);
      wcagResults.push({ page: pageDef.name, title: 'FAIL', landmarks: 'FAIL', labels: 'FAIL', images: 'FAIL', headings: 'FAIL', focus: 'FAIL', tabindex: 'FAIL' });
      await ctx.close();
      continue;
    }

    const checks = {};

    // title
    const title = await page.title().catch(() => '');
    checks.title = title.length > 0 ? 'PASS' : 'FAIL';
    log(checks.title === 'PASS' ? 'PASS' : 'FAIL', 'Title', `${pageDef.url} — "${title}"`);

    // ARIA landmarks
    const landmarks = await page.evaluate(() => {
      const els = {
        nav: document.querySelectorAll('nav, [role="navigation"]').length,
        main: document.querySelectorAll('main, [role="main"]').length,
        header: document.querySelectorAll('header, [role="banner"]').length,
        footer: document.querySelectorAll('footer, [role="contentinfo"]').length,
      };
      return els;
    });
    checks.landmarks = (landmarks.nav > 0 && landmarks.main > 0) ? 'PASS' : 'WARN';
    log(checks.landmarks === 'PASS' ? 'PASS' : 'WARN', 'Landmarks', JSON.stringify(landmarks));

    // Image alt text
    const imgIssues = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const issues = [];
      for (const img of imgs) {
        if (!img.hasAttribute('alt') && !img.hasAttribute('aria-hidden')) {
          issues.push(img.src || img.outerHTML.slice(0, 80));
        }
      }
      return issues;
    });
    checks.images = imgIssues.length === 0 ? 'PASS' : 'FAIL';
    if (imgIssues.length > 0) {
      log('FAIL', 'Images w/o alt', `${imgIssues.length} images missing alt text`);
      for (const iss of imgIssues.slice(0, 5)) log('EVIDENCE', 'Missing alt', iss);
    } else {
      log('PASS', 'Images w/o alt', '0 issues');
    }

    // Form labels
    const labelIssues = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      const issues = [];
      for (const inp of inputs) {
        const id = inp.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = inp.hasAttribute('aria-label') || inp.hasAttribute('aria-labelledby');
        if (!hasLabel && !hasAriaLabel && inp.type !== 'hidden' && inp.type !== 'submit' && inp.type !== 'button') {
          issues.push(`${inp.name || inp.type || 'unnamed'} (id="${id}")`);
        }
      }
      return issues;
    });
    checks.labels = labelIssues.length === 0 ? 'PASS' : 'FAIL';
    if (labelIssues.length > 0) {
      log('FAIL', 'Unlabeled inputs', `${labelIssues.length} inputs missing labels`);
      for (const iss of labelIssues.slice(0, 5)) log('EVIDENCE', 'No label', iss);
    } else {
      log('PASS', 'Input labels', 'All inputs have labels');
    }

    // Heading order
    const headingOrder = await page.evaluate(() => {
      const hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const order = [];
      let lastLevel = 0;
      const issues = [];
      for (const h of hs) {
        const level = parseInt(h.tagName[1]);
        order.push({ level, text: h.textContent.trim().slice(0, 50) });
        if (level - lastLevel > 1 && lastLevel > 0) {
          issues.push(`h${lastLevel} → h${level}: "${h.textContent.trim().slice(0, 40)}"`);
        }
        lastLevel = level;
      }
      return { order, issues };
    });
    checks.headings = headingOrder.issues.length === 0 ? 'PASS' : 'WARN';
    if (headingOrder.issues.length > 0) {
      log('WARN', 'Heading order', `${headingOrder.issues.length} skip(s)`);
      for (const iss of headingOrder.issues) log('EVIDENCE', 'Heading skip', iss);
    } else {
      log('PASS', 'Heading order', 'Logical');
    }

    // Tabindex > 0
    const badTabindex = await page.evaluate(() => {
      const els = document.querySelectorAll('[tabindex]');
      return Array.from(els).filter(el => parseInt(el.getAttribute('tabindex')) > 0).map(el => el.tagName + (el.id ? '#'+el.id : ''));
    });
    checks.tabindex = badTabindex.length === 0 ? 'PASS' : 'FAIL';
    if (badTabindex.length > 0) {
      log('FAIL', 'tabindex > 0', `${badTabindex.length} element(s): ${badTabindex.join(', ')}`);
    } else {
      log('PASS', 'tabindex > 0', 'None found');
    }

    // Focus indicators
    const focusVisible = await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '*:focus { outline: 2px solid Highlight !important; }';
      document.head.appendChild(style);
      // Check if there's a :focus style defined
      const sheets = document.styleSheets;
      let hasFocusStyle = false;
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText && rule.selectorText.includes(':focus')) {
              hasFocusStyle = true;
            }
          }
        } catch (e) { /* cross-origin */ }
      }
      return hasFocusStyle;
    });
    checks.focus = focusVisible ? 'PASS' : 'WARN';
    log(focusVisible ? 'PASS' : 'WARN', 'Focus styles', focusVisible ? ':focus rules found' : 'No explicit :focus styles in CSS');

    // Interactive elements focusable
    const focusableCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').length;
    });
    log('INFO', 'Focusable elements', `${focusableCount} interactive elements`);

    // Color contrast check (simplified — check for text on backgrounds)
    const contrastIssues = await page.evaluate(() => {
      const issues = [];
      const els = document.querySelectorAll('p, span, a, h1, h2, h3, h4, h5, h6, label, button, li');
      const seen = new Set();
      for (const el of els) {
        if (seen.has(el) || !el.parentElement) continue;
        seen.add(el);
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        // Only check if both are solid colors (not transparent gradients)
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
        if (color && bg && color !== bg) {
          // Simple heuristic: if they exist and differ, we can't easily compute WCAG ratio without a color lib
        }
      }
      return issues;
    });
    log('INFO', 'Color contrast', 'Skipping computed ratio (requires color library) — manual review recommended');

    wcagResults.push({ page: pageDef.name, ...checks });
    await ctx.close();
  }

  heading('Accessibility Scorecard', 3);
  const wcagHeaders = ['Page', 'Title', 'Landmarks', 'Labels', 'Images', 'Headings', 'Focus', 'tabindex'];
  const wcagRows = wcagResults.map(r => [
    r.page, r.title, r.landmarks, r.labels, r.images, r.headings, r.focus, r.tabindex
  ]);
  table(wcagHeaders, wcagRows);
}

// ─── 3. Performance ────────────────────────────────────────
async function performance(browser) {
  heading('3. Performance Audit');

  const pages = ['/', '/login', '/signup', '/forgot-password', '/onboarding', '/settings'];
  const perfData = [];

  for (const urlPath of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    const resources = [];
    page.on('response', resp => {
      const url = resp.url();
      const ct = resp.headers()['content-type'] || '';
      const cl = parseInt(resp.headers()['content-length'] || '0');
      if (url.startsWith(BASE)) {
        resources.push({ url, ct, size: cl, status: resp.status() });
      }
    });

    try {
      await page.goto(`${BASE}${urlPath}`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(500);
    } catch (e) {
      log('ERROR', 'Perf', `${urlPath}: ${e.message}`);
      await ctx.close();
      continue;
    }

    const metrics = await client.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
    const m = {};
    for (const metric of metrics.metrics) {
      m[metric.name] = metric.value;
    }

    const timing = await page.evaluate(() => {
      const p = performance.timing;
      return {
        domContentLoaded: p.domContentLoadedEventEnd - p.navigationStart,
        load: p.loadEventEnd - p.navigationStart,
        firstPaint: (performance.getEntriesByType('paint').find(e => e.name === 'first-paint')?.startTime || 0),
        firstContentfulPaint: (performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')?.startTime || 0),
      };
    }).catch(() => ({}));

    // Bundle sizes
    const jsResources = resources.filter(r => r.ct?.includes('javascript') || r.url.match(/\.(js|mjs)$/));
    const totalJSSize = jsResources.reduce((a, r) => a + r.size, 0);
    const cssResources = resources.filter(r => r.ct?.includes('css'));
    const totalCSSSize = cssResources.reduce((a, r) => a + r.size, 0);
    const imgResources = resources.filter(r => r.ct?.includes('image'));
    const totalImgSize = imgResources.reduce((a, r) => a + r.size, 0);
    const fontResources = resources.filter(r => r.ct?.includes('font'));
    const totalFontSize = fontResources.reduce((a, r) => a + r.size, 0);

    // Render-blocking: check for <link rel="stylesheet"> in <head> (not async/not media="print")
    const blockingCSS = await page.evaluate(() => {
      const links = document.querySelectorAll('head link[rel="stylesheet"]');
      return Array.from(links).filter(l => !l.media && !l.hasAttribute('async')).length;
    });

    const entry = {
      page: urlPath,
      domContentLoaded: (timing.domContentLoaded || 0).toFixed(0),
      loadEvent: (timing.load || 0).toFixed(0),
      firstPaint: (timing.firstPaint || 0).toFixed(0),
      fcp: (timing.firstContentfulPaint || 0).toFixed(0),
      jsSize: (totalJSSize / 1024).toFixed(1) + ' KB',
      cssSize: (totalCSSSize / 1024).toFixed(1) + ' KB',
      imgSize: (totalImgSize / 1024).toFixed(1) + ' KB',
      fontSize: (totalFontSize / 1024).toFixed(1) + ' KB',
      totalResources: resources.length,
      blockingCSS,
    };
    perfData.push(entry);
    log('INFO', 'Perf', `${urlPath}: DOM=${entry.domContentLoaded}ms Load=${entry.loadEvent}ms FCP=${entry.fcp}ms JS=${entry.jsSize}`);

    await ctx.close();
  }

  heading('Performance Metrics', 3);
  const perfHeaders = ['Page', 'DOMContentLoaded', 'Load', 'FirstPaint', 'FCP', 'JS Size', 'CSS Size', 'Img Size', 'Font Size', 'Resources', 'Blocking CSS'];
  const perfRows = perfData.map(e => [
    e.page, e.domContentLoaded + 'ms', e.loadEvent + 'ms', e.firstPaint + 'ms', e.fcp + 'ms',
    e.jsSize, e.cssSize, e.imgSize, e.fontSize, String(e.totalResources), String(e.blockingCSS)
  ]);
  table(perfHeaders, perfRows);

  text('\n### 3.1 API Response Times');
  const apiEndpoints = [
    '/api/applications', '/api/jobs', '/api/pipeline', '/api/summary', '/api/profile',
  ];
  for (const ep of apiEndpoints) {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        await fetch(`${BASE}${ep}`, { signal: AbortSignal.timeout(10000) });
        times.push(Date.now() - start);
      } catch (e) {
        times.push(-1);
      }
    }
    const valid = times.filter(t => t > 0);
    const avg = valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(0) : 'FAIL';
    const min = valid.length > 0 ? Math.min(...valid) : '-';
    const max = valid.length > 0 ? Math.max(...valid) : '-';
    log(avg === 'FAIL' ? 'FAIL' : 'INFO', 'API', `${ep}: avg=${avg}ms min=${min}ms max=${max}ms (${valid.length}/5)`);
  }
}

// ─── 4. Console Error Audit ────────────────────────────────
async function consoleErrors(browser) {
  heading('4. Console Error & Warning Audit');

  const pages = ['/', '/login', '/signup', '/forgot-password', '/onboarding', '/settings'];
  const allErrors = {};

  for (const urlPath of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const pageErrors = [];

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        pageErrors.push({ type, text, url: urlPath });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push({ type: 'uncaught', text: err.message, url: urlPath });
    });

    try {
      await page.goto(`${BASE}${urlPath}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(500);
    } catch (e) {
      // continue
    }

    // Categorize
    for (const err of pageErrors) {
      const key = err.text;
      if (!allErrors[key]) {
        allErrors[key] = { ...err, count: 0, pages: new Set() };
      }
      allErrors[key].count++;
      allErrors[key].pages.add(err.url);
    }

    await ctx.close();
  }

  const entries = Object.entries(allErrors);
  if (entries.length === 0) {
    log('PASS', 'Console', 'No errors or warnings found');
    return;
  }

  // Categorize
  const categories = { API: 0, React: 0, HMR: 0, Runtime: 0, Network: 0, Other: 0 };
  for (const [msg, info] of entries) {
    let cat = 'Other';
    if (msg.includes('API') || msg.includes('api/') || msg.includes('fetch') || msg.includes('network') || msg.includes('NetworkError') || msg.includes('Failed to load')) cat = 'API';
    else if (msg.includes('React') || msg.includes('react') || msg.includes('did not match') || msg.includes('hydrat')) cat = 'React';
    else if (msg.includes('HMR') || msg.includes('WebSocket') || msg.includes('hot-module')) cat = 'HMR';
    else if (msg.includes('TypeError') || msg.includes('ReferenceError') || msg.includes('undefined')) cat = 'Runtime';
    else if (msg.includes('404') || msg.includes('403') || msg.includes('5')) cat = 'Network';
    categories[cat] = (categories[cat] || 0) + info.count;
  }

  text('\n### Categories');
  for (const [cat, count] of Object.entries(categories)) {
    log(count > 0 ? 'WARN' : 'INFO', cat, `${count} messages`);
  }

  text('\n### Unique error messages');
  const sorted = entries.sort((a, b) => b[1].count - a[1].count);
  for (const [msg, info] of sorted.slice(0, 30)) {
    const pages = [...info.pages].join(', ');
    log(info.type === 'error' ? 'ERROR' : 'WARN', `x${info.count}`, `${msg.slice(0, 200)} [${pages}]`);
  }
}

// ─── 5. Cookie & Storage Audit ─────────────────────────────
async function cookieStorageAudit(browser) {
  heading('5. Cookie & Storage Audit');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 20000 });

    // Cookies
    const cookies = await page.context().cookies();
    text('\n### 5.1 Cookies');
    if (cookies.length === 0) {
      log('INFO', 'Cookies', 'No cookies set by the application');
    }
    for (const c of cookies) {
      const flags = [];
      if (c.httpOnly) flags.push('HttpOnly');
      if (c.secure) flags.push('Secure');
      if (c.sameSite) flags.push(`SameSite=${c.sameSite}`);
      const sev = !c.httpOnly && c.name.match(/session|token|auth|key/i) ? 'CRITICAL' :
                  c.sameSite === 'Strict' || c.sameSite === 'Lax' ? 'INFO' : 'WARNING';
      log(sev, 'Cookie', `${c.name}: domain=${c.domain} flags=${flags.join(',') || 'NONE'}`);
    }

    // localStorage / sessionStorage
    const storage = await page.evaluate(() => {
      const ls = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        ls[key] = localStorage.getItem(key).slice(0, 100);
      }
      const ss = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        ss[key] = sessionStorage.getItem(key).slice(0, 100);
      }
      return { localStorage: ls, sessionStorage: ss };
    }).catch(() => ({ localStorage: {}, sessionStorage: {} }));

    text('\n### 5.2 localStorage');
    const lsKeys = Object.keys(storage.localStorage);
    if (lsKeys.length === 0) {
      log('INFO', 'localStorage', 'No keys found');
    }
    for (const key of lsKeys) {
      const val = storage.localStorage[key];
      const sev = key.match(/token|auth|key|secret|password|jwt/i) ? 'CRITICAL' : 'INFO';
      log(sev, 'localStorage', `${key} = ${val.slice(0, 80)}`);
    }

    text('\n### 5.3 sessionStorage');
    const ssKeys = Object.keys(storage.sessionStorage);
    if (ssKeys.length === 0) {
      log('INFO', 'sessionStorage', 'No keys found');
    }
    for (const key of ssKeys) {
      const val = storage.sessionStorage[key];
      const sev = key.match(/token|auth|key|secret|password|jwt/i) ? 'CRITICAL' : 'INFO';
      log(sev, 'sessionStorage', `${key} = ${val.slice(0, 80)}`);
    }

  } finally {
    await ctx.close();
  }
}

// ─── 6. CLI Script Audit ───────────────────────────────────
async function cliScriptAudit() {
  heading('6. CLI Script Audit');

  const mjsFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.mjs'));
  const findings = [];

  for (const file of mjsFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    const lines = content.split('\n');

    // Hardcoded secrets
    const secretPatterns = [
      { pattern: /(?:api[_-]?key|apikey|secret|password|token|auth)[\s]*[:=][\s]*['"][^'"]{8,}['"]/i, sev: 'CRITICAL', label: 'Hardcoded secret' },
      { pattern: /process\.env\.(?:API_KEY|SECRET|TOKEN|PASSWORD)/, sev: 'INFO', label: 'Env var ref' },
    ];

    for (const { pattern, sev, label } of secretPatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          findings.push({ file, line: i + 1, sev, label, snippet: lines[i].trim().slice(0, 100) });
        }
      }
    }

    // eval / exec
    if (content.includes('eval(')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('eval(')) {
          findings.push({ file, line: i + 1, sev: 'CRITICAL', label: 'eval() usage', snippet: lines[i].trim().slice(0, 100) });
        }
      }
    }

    if (content.includes('exec(') || content.includes('execSync(')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('exec(') || lines[i].includes('execSync(')) {
          findings.push({ file, line: i + 1, sev: 'WARNING', label: 'exec() usage — check sanitization', snippet: lines[i].trim().slice(0, 100) });
        }
      }
    }

    if (content.includes('execFile(')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('execFile(')) {
          findings.push({ file, line: i + 1, sev: 'INFO', label: 'execFile() usage', snippet: lines[i].trim().slice(0, 100) });
        }
      }
    }

    // File writes outside project
    if (content.includes('writeFileSync') || content.includes('writeFile(')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/writeFile(Sync)?\s*\(/) && !lines[i].includes('path.join') && !lines[i].includes('cwd')) {
          const m = lines[i].match(/writeFile(Sync)?\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (m) {
            findings.push({ file, line: i + 1, sev: 'MEDIUM', label: 'File write - check path safety', snippet: m[2] });
          }
        }
      }
    }

    // Missing error handling on async
    const asyncFuncs = content.match(/async\s+function/g) || [];
    const tryCatchCount = (content.match(/try\s*{/g) || []).length;
    if (asyncFuncs.length > 0 && tryCatchCount === 0) {
      findings.push({ file, line: 1, sev: 'MEDIUM', label: `No try/catch found (${asyncFuncs.length} async functions)` });
    }
  }

  // Check package.json scripts
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const dangerousScripts = [];
  for (const [name, script] of Object.entries(pkg.scripts || {})) {
    if (script.includes('rm -rf') || script.includes('rimraf') || script.includes('&& rm')) {
      dangerousScripts.push({ name, script, sev: 'WARNING', label: 'Destructive script' });
    }
    if (script.includes('> /dev') || script.includes('2>&1') && !script.includes('test')) {
      // might be fine
    }
  }

  heading('CLI Audit Findings Detail', 3);

  const sevOrder = { CRITICAL: 0, WARNING: 1, MEDIUM: 2, INFO: 3 };
  findings.sort((a, b) => (sevOrder[a.sev] || 9) - (sevOrder[b.sev] || 9));

  const fHeaders = ['Severity', 'File', 'Line', 'Issue', 'Snippet'];
  const fRows = findings.map(f => [f.sev, f.file, String(f.line), f.label, (f.snippet || '').slice(0, 60)]);
  table(fHeaders, fRows);

  if (dangerousScripts.length > 0) {
    text('\n### Dangerous package.json scripts');
    for (const s of dangerousScripts) {
      log(s.sev, 'package.json', `${s.name}: ${s.script}`);
    }
  }

  // Summary counts
  const counts = {};
  for (const f of findings) counts[f.sev] = (counts[f.sev] || 0) + 1;
  text('\n### CLI Script Audit Summary');
  for (const [sev, c] of Object.entries(counts)) {
    log(sev, 'Count', String(c));
  }
}

// ─── 7. Dependency Audit ───────────────────────────────────
async function dependencyAudit() {
  heading('7. Dependency Audit');

  // npm audit — check both root and web
  const auditDirs = [
    { dir: ROOT, name: 'Root' },
    { dir: path.join(ROOT, 'web'), name: 'Web' },
  ];

  for (const { dir, name } of auditDirs) {
    try {
      let auditOut;
      try {
        auditOut = execSync('npm audit --json', { cwd: dir, encoding: 'utf-8', timeout: 30000 });
      } catch (e) {
        // npm exits non-zero when vulns found, stdout still has JSON
        auditOut = e.stdout || '';
      }
      if (!auditOut) throw new Error('No audit output');
      const audit = JSON.parse(auditOut);
      const vulns = audit.vulnerabilities || {};
      const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
      const vulnList = [];

      for (const [pkgName, info] of Object.entries(vulns)) {
        if (info.severity && counts[info.severity] !== undefined) {
          counts[info.severity]++;
        }
        const viaStr = Array.isArray(info.via) ? info.via.map(v => typeof v === 'object' ? v.title || v.name : v).join('; ') : (info.via || '');
        const fix = info.fixAvailable === false ? 'No fix' : (typeof info.fixAvailable === 'object' ? `${info.fixAvailable.name}@${info.fixAvailable.version}` : 'Available');
        vulnList.push({ pkg: pkgName, severity: info.severity, via: viaStr, fixAvailable: fix });
      }

      text(`\n### 7.1 npm Audit Results (${name})`);
      log('INFO', 'Audit', `${name}: Critical: ${counts.critical}, High: ${counts.high}, Moderate: ${counts.moderate}, Low: ${counts.low}`);

      if (vulnList.length > 0) {
        const vHeaders = ['Package', 'Severity', 'Advisory', 'Fix'];
        const vRows = vulnList.map(v => [v.pkg, v.severity, v.via.slice(0, 80), v.fixAvailable.slice(0, 40)]);
        table(vHeaders, vRows);
      }
    } catch (e) {
      log('INFO', 'npm audit', `${name}: Failed: ${e.message.slice(0, 120)}`);
    }
  }

  // Check key versions
  text('\n### 7.2 Key Dependency Versions');
  const deps = {
    next: null,
    prisma: null,
    react: null,
    'react-dom': null,
    playwright: null,
    supabase: null,
  };
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const allDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
  
  // web package.json
  const webPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'package.json'), 'utf-8'));
  const webDeps = { ...webPkg.dependencies, ...webPkg.devDependencies };

  const depVersions = {};
  for (const [name, ver] of Object.entries(webDeps)) {
    depVersions[name] = ver;
  }
  for (const [name, ver] of Object.entries(allDeps)) {
    if (!depVersions[name]) depVersions[name] = ver;
  }

  for (const key of Object.keys(deps)) {
    if (depVersions[key]) {
      log('INFO', key, depVersions[key].replace('^', '').replace('~', ''));
    } else {
      log('INFO', key, 'Not found');
    }
  }

  // CVE check for Next.js 14.2.15
  const nextVer = depVersions.next?.replace(/[\^~]/, '') || 'unknown';
  log('INFO', 'Next.js CVE check', `Version ${nextVer} — 14.2.15 is a security patch release, check https://github.com/advisories?query=next.js`);

  // Prisma CVE check
  const prismaVer = depVersions.prisma?.replace(/[\^~]/, '') || (depVersions['@prisma/client']?.replace(/[\^~]/, '')) || 'unknown';
  log('INFO', 'Prisma CVE check', `Version ${prismaVer} — check https://github.com/prisma/prisma/security`);

  // Check for outdated deps
  text('\n### 7.3 Outdated Check');
  try {
    const outdatedOut = execSync('npm outdated --json', { cwd: ROOT, encoding: 'utf-8', timeout: 15000 });
    const outdated = JSON.parse(outdatedOut);
    for (const [pkgName, info] of Object.entries(outdated)) {
      log(info.current && info.latest && info.current !== info.latest ? 'WARN' : 'INFO', pkgName, `${info.current} → ${info.latest}`);
    }
  } catch (e) {
    log('INFO', 'npm outdated', 'All up to date or check failed');
  }
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  heading('Jobops E2E Infrastructure + Accessibility + Performance Audit', 1);
  text(`\n**Date:** ${new Date().toISOString()}`);
  text(`**Base URL:** ${BASE}`);
  text(`**Root:** ${ROOT}`);

  heading('Executive Summary', 2);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  } catch (e) {
    log('ERROR', 'Playwright', `Failed to launch: ${e.message}`);
    process.exit(1);
  }

  try {
    await infraSecurity();
    await accessibility(browser);
    await performance(browser);
    await consoleErrors(browser);
    await cookieStorageAudit(browser);
    await cliScriptAudit();
    await dependencyAudit();
  } catch (e) {
    log('ERROR', 'Global', `Audit crashed: ${e.message}\n${e.stack}`);
  } finally {
    await browser.close();
  }

  // Count findings by severity
  const sevCounts = { CRITICAL: 0, WARNING: 0, FAIL: 0, ERROR: 0, PASS: 0 };
  for (const line of reportLines) {
    const m = line.match(/^\| (\w+)/);
    if (m && sevCounts[m[1]] !== undefined) sevCounts[m[1]]++;
  }

  text('\n---\n### Finding Summary');
  for (const [sev, count] of Object.entries(sevCounts)) {
    text(`- **${sev}:** ${count}`);
  }

  // Write report
  const reportPath = path.join(ROOT, 'reports', 'e2e-infra-audit-bug-report.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
  console.log(`\n✅ Report written to ${reportPath}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
