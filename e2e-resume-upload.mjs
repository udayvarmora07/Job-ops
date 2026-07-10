#!/usr/bin/env node

import { chromium } from "playwright";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4317;
const BASE = `http://localhost:${PORT}`;
const WEB_ROOT = join(__dirname, "web");
const RESUME_PDF = "/tmp/test-resume.pdf";

const EMAIL = "pateluday836@gmail.com";
const PASSWORD = "TestQA2026!";
const SUPABASE_URL = "https://gwanlymyqeulyvumimsy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tIaeaQKyFNjrcjECVFOgHA_GBoQx0No";

let passed = 0, failed = 0, warnings = 0;
function pass(m) { console.log(`  \x1b[32m✓\x1b[0m ${m}`); passed++; }
function fail(m) { console.log(`  \x1b[31m✗\x1b[0m ${m}`); failed++; }
function warn(m) { console.log(`  \x1b[33m⚠\x1b[0m ${m}`); warnings++; }

let server = null;
function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      cwd: WEB_ROOT,
      env: { ...process.env, NODE_ENV: "development", PORT: String(PORT) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let ok = false;
    const t = setTimeout(() => { if (!ok) reject(new Error("Timeout")); }, 90000);
    const h = (d) => { const s = d.toString(); if ((s.includes("localhost") || s.includes("Ready") || s.includes("compiled")) && !ok) { ok = true; clearTimeout(t); setTimeout(resolve, 2000); } };
    server.stdout.on("data", h); server.stderr.on("data", h);
    server.on("error", (e) => { if (!ok) reject(e); });
  });
}
function stopServer() { if (server) { server.kill("SIGTERM"); server = null; } }

async function ss(page, name) {
  const d = join(__dirname, "reports", "e2e-resume-upload-screenshots");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  await page.screenshot({ path: join(d, `${name}.png`), fullPage: true });
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  RESUME UPLOAD — Final Diagnostic");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Direct API Tests ──
  console.log("1. DIRECT API TESTS");
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const auth = await authResp.json();
  if (!auth.access_token) { fail("Auth failed"); process.exit(1); }
  pass("API token acquired");

  await startServer();
  console.log(`   Server at ${BASE}\n`);

  try {
    // Text parse test
    console.log("A. TEXT PARSE");
    const cvText = readFileSync(join(__dirname, "cv.md"), "utf8");
    const r1 = await fetch(`${BASE}/api/profile/parse-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.access_token}` },
      body: JSON.stringify({ text: cvText }),
    });
    const d1 = await r1.json();
    if (r1.ok) {
      pass(`Status 200, ${Object.keys(d1.parsed || {}).length} fields`);
    } else {
      fail(`Status ${r1.status}: ${d1.error || JSON.stringify(d1)}`);
    }

    // File upload test
    console.log("\nB. FILE UPLOAD");
    const pdf = readFileSync(RESUME_PDF);
    const fd = new FormData();
    fd.append("file", new Blob([pdf], { type: "application/pdf" }), "resume.pdf");
    const r2 = await fetch(`${BASE}/api/profile/parse-resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.access_token}` },
      body: fd,
    });
    if (r2.ok) {
      const d2 = await r2.json();
      const p = d2.parsed || {};
      pass(`Status 200, ${Object.keys(p).length} fields, name="${p.fullName}"`);
      if (p.targetRoles?.includes("DevOps Engineer")) pass("targetRoles includes 'DevOps Engineer'");
      if (p.superpowers?.includes("Terraform")) pass("superpowers includes 'Terraform'");
      if (p.city === "Ahmedabad") pass("city = Ahmedabad");
    } else {
      const e2 = await r2.json().catch(() => ({}));
      fail(`Status ${r2.status}: ${e2.error || JSON.stringify(e2)}`);
    }

    // ── Browser test with full API response capture ──
    console.log("\nC. BROWSER UI UPLOAD");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Track parse-resume request completion
    let parseResponse = null;
    let parseResponseData = null;
    page.on("response", async (resp) => {
      if (resp.url().includes("/api/profile/parse-resume")) {
        parseResponse = resp;
        try { parseResponseData = await resp.json(); } catch {}
      }
    });

    // Login
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 15000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Navigate to onboarding
    await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    await ss(page, "01-onboarding");

    // Upload file
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) { fail("File input not found"); await browser.close(); return; }

    await fileInput.setInputFiles(RESUME_PDF);
    const uploadTime = Date.now();

    // Wait up to 60s for response
    while (!parseResponse && Date.now() - uploadTime < 60000) {
      await page.waitForTimeout(500);
    }
    const elapsed = ((Date.now() - uploadTime) / 1000).toFixed(1);

    if (parseResponse) {
      const status = parseResponse.status();
      pass(`Parse API responded in ${elapsed}s with status ${status}`);

      if (status === 200 && parseResponseData) {
        const p = parseResponseData.parsed || {};
        pass(`API returned ${Object.keys(p).length} parsed fields`);

        // Check specific fields
        const checks = [
          { field: "fullName", value: p.fullName },
          { field: "targetRoles", value: p.targetRoles?.join(", ") },
          { field: "superpowers", value: p.superpowers?.slice(0, 3).join(", ") },
          { field: "city", value: p.city },
        ];
        for (const c of checks) {
          if (c.value) pass(`parse-resume returned ${c.field}="${c.value}"`);
          else warn(`parse-resume missing ${c.field}`);
        }
      } else if (status === 401) {
        fail("Parse API returned 401 — auth issue in browser");
      } else {
        const errMsg = parseResponseData?.error || `HTTP ${status}`;
        fail(`Parse API failed: ${errMsg}`);
      }
    } else {
      fail("No parse API response within 60s");
    }

    // Wait for UI update
    await page.waitForTimeout(5000);
    const body = await page.textContent("body");
    const hasBadge = body.includes("auto-filled") || body.includes("check this");
    const hasError = body.includes("We couldn't read") || body.includes("Try pasting");

    if (hasBadge) {
      pass("Auto-filled badges rendered in UI");
    } else if (hasError) {
      const errEl = await page.$(".text-destructive");
      const errText = errEl ? await errEl.textContent() : "unknown";
      fail(`Upload error in UI: "${errText}"`);
    } else {
      warn("No auto-filled badges — may need more time or fields were already filled");
      console.log(`   Body sample: ${body.substring(200, 400)}`);
    }
    await ss(page, "02-after-upload");

    await browser.close();

    // ── Summary ──
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
    console.log("═══════════════════════════════════════════════════════════");

  } catch (e) {
    console.error(`\n  💥 ${e.message}`);
    failed++;
  } finally {
    stopServer();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
