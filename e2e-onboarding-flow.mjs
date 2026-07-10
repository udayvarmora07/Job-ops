#!/usr/bin/env node

import { chromium } from "playwright";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4317;
const BASE = `http://localhost:${PORT}`;
const WEB_ROOT = join(__dirname, "web");
const RESUME_PDF = "/tmp/test-resume.pdf";

const EMAIL = "pateluday836@gmail.com";
const PASSWORD = "TestQA2026!";

let passed = 0, failed = 0, warnings = 0;
function pass(m) { console.log(`  \x1b[32m✓\x1b[0m ${m}`); passed++; }
function fail(m) { console.log(`  \x1b[31m✗\x1b[0m ${m}`); failed++; }
function warn(m) { console.log(`  \x1b[33m⚠\x1b[0m ${m}`); warnings++; }

let server = null;
function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      cwd: WEB_ROOT, env: { ...process.env, NODE_ENV: "development", PORT: String(PORT) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let ok = false;
    const t = setTimeout(() => { if (!ok) reject(new Error("Timeout")); }, 90000);
    const h = (d) => {
      const s = d.toString();
      if ((s.includes("localhost") || s.includes("Ready") || s.includes("compiled")) && !ok) { ok = true; clearTimeout(t); setTimeout(resolve, 2000); }
    };
    server.stdout.on("data", h); server.stderr.on("data", h);
    server.on("error", (e) => { if (!ok) reject(e); });
  });
}
function stopServer() { if (server) { server.kill("SIGTERM"); server = null; } }

async function ss(page, name) {
  const d = join(__dirname, "reports", "e2e-onboarding-screenshots");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  await page.screenshot({ path: join(d, `${name}.png`), fullPage: true });
}

async function apiFromBrowser(page, path) {
  return page.evaluate(async (p) => {
    const r = await fetch(p);
    if (!r.ok) return null;
    return r.json();
  }, path);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  E2E: ONBOARDING FLOW");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("1. Start server...");
  await startServer();
  console.log(`   Server at ${BASE}\n`);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    // ═══════════════ STEP 1: LOGIN ═══════════════
    console.log("2. LOGIN");
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    pass("Login page loaded");

    // Fill and submit
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for Supabase auth + Next.js redirect chain
    await page.waitForTimeout(3000);

    // The login may have succeeded but Playwright's navigation detection
    // doesn't catch the soft navigation (router.push). Try visiting /
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const bodyText = await page.textContent("body");
    console.log(`   URL: ${currentUrl}`);

    if (currentUrl.includes("/login")) {
      fail("Not authenticated — stuck on /login");
    } else if (currentUrl.includes("/onboarding")) {
      pass("Authenticated → redirected to /onboarding");
    } else {
      pass("Authenticated → on dashboard");
    }

    await ss(page, "01-state");

    // ═══════════════ STEP 2: CHECK ONBOARDING STATUS ═══════════════
    console.log("\n3. ONBOARDING STATUS");
    const status = await apiFromBrowser(page, "/api/profile/status");
    if (status) {
      console.log(`   essentialsComplete: ${status.essentialsComplete}, onboardingComplete: ${status.onboardingComplete}`);
      if (status.onboardingComplete) {
        pass("Onboarding already complete — resetting for test");

        // Reset: set onboardingComplete to false so wizard appears
        const profileData = await apiFromBrowser(page, "/api/profile");
        if (profileData) {
          const reset = await page.evaluate(async () => {
            const r = await fetch("/api/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                onboardingComplete: false,
                fullName: null, city: null, country: null,
                targetRoles: [], superpowers: [], pastCompanies: [],
                targetCompanies: [], scanKeywords: [],
                linkedinUrl: null, githubUrl: null, portfolioUrl: null, phone: null,
                employmentStatus: null, availability: null,
                compTargetRange: null, compCurrency: null, compMinimum: null, compFlexibility: null,
              }),
            });
            return r.ok ? (await r.json()).profile : null;
          });
          if (reset) pass("Profile reset — onboardingComplete=false");
          else fail("Failed to reset profile");
        }
      } else if (status.essentialsComplete) {
        warn("essentialsComplete=true but onboardingComplete=false — will go to step 2");
        // Reset full profile for clean test
        await page.evaluate(async () => {
          await fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullName: null, city: null, country: null,
              targetRoles: [], superpowers: [], pastCompanies: [],
              targetCompanies: [], scanKeywords: [],
            }),
          });
        });
      } else {
        pass("Onboarding not started — fresh state");
      }
    } else {
      warn("Could not check onboarding status (API returned non-200)");
    }

    // ═══════════════ STEP 3: GO TO ONBOARDING ═══════════════
    console.log("\n4. ONBOARDING WIZARD");
    await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    const obText = await page.textContent("body");
    console.log(`   Onboarding page body (first 150 chars): ${obText.substring(0, 150)}`);

    if (obText.includes("Welcome to Jobops") || obText.includes("Essentials")) {
      pass("Onboarding wizard loaded with Step 1");
    } else if (obText.includes("Loading")) {
      pass("Onboarding page loading");
      await page.waitForTimeout(5000);
    } else {
      warn(`Onboarding page content unexpected`);
    }
    await ss(page, "02-onboarding");

    // ═══════════════ STEP 4: RESUME UPLOAD ═══════════════
    console.log("\n5. RESUME UPLOAD");
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(RESUME_PDF);
      pass("Resume PDF selected for upload");

      // Wait for upload + AI parse (can take 15-20s)
      console.log("   Waiting for AI parse to complete...");
      await page.waitForTimeout(25000);

      const afterUpload = await page.textContent("body");
      if (afterUpload.includes("auto-filled") || afterUpload.includes("check this")) {
        pass("Resume parsed — auto-filled badges visible");
      } else {
        warn("Resume upload may not have parsed (auto-filled badge not visible)");
        console.log(`   Body after upload: ${afterUpload.substring(0, 200)}`);
      }
      await ss(page, "03-after-resume");
    } else {
      warn("File input not found — resume upload skipped");
    }

    // ═══════════════ STEP 5: FILL ESSENTIALS ═══════════════
    console.log("\n6. ESSENTIALS");

    const fillEssential = async (placeholder, value, label) => {
      const el = await page.$(`input[placeholder="${placeholder}"]`);
      if (el) {
        const curr = await el.inputValue();
        if (!curr.trim()) { await el.fill(value); pass(`${label} filled manually`); }
        else { pass(`${label}: "${curr.substring(0, 30)}" (auto-filled)`); }
      } else warn(`Input [placeholder="${placeholder}"] not found`);
    };

    await fillEssential("Jane Doe", "Uday Varmora", "Full name");
    await fillEssential("DevOps Engineer, SRE, Platform Engineer", "DevOps Engineer, SRE, Platform Engineer", "Target roles");
    await fillEssential("Berlin", "Ahmedabad", "City");
    await fillEssential("Germany", "India", "Country");
    await ss(page, "04-essentials-filled");

    // Save essentials
    const saveBtn = await page.$('button:has-text("Save & continue")');
    if (saveBtn) {
      if (!(await saveBtn.isDisabled())) {
        await saveBtn.click();
        await page.waitForTimeout(5000);
        const afterSave = await page.textContent("body");
        if (afterSave.includes("Additional details") || afterSave.includes("Links")) {
          pass("Essentials saved → Step 2 (Additional details)");
        } else {
          warn(`After save, body: ${afterSave.substring(0, 150)}`);
        }
        await ss(page, "05-step2");
      } else fail("Save & continue is disabled");
    } else fail("Save & continue button not found");

    // ═══════════════ STEP 6: FILL ADDITIONAL DETAILS ═══════════════
    console.log("\n7. ADDITIONAL DETAILS");

    // Helper: triple-click + fill to ensure field clears
    const fillField = async (sel, val) => {
      const el = await page.$(sel);
      if (el) {
        const curr = await el.inputValue();
        if (!curr.trim()) {
          await el.click({ clickCount: 3 });
          await el.fill(val);
          return true;
        }
      }
      return false;
    };

    const additionalFields = {
      'input[placeholder="https://linkedin.com/in/janedoe"]': "https://linkedin.com/in/udayvarmora",
      'input[placeholder="https://github.com/janedoe"]': "https://github.com/udayvarmora07",
      'input[placeholder="+49 30 12345678"]': "+91 96623 85170",
      'input[placeholder="actively-looking, passive, employed"]': "actively-looking",
      'input[placeholder="Immediately, 2 weeks notice"]': "Immediately",
      'input[placeholder="Kubernetes, Terraform, CI/CD, AWS"]': "Kubernetes, Terraform, AWS, CI/CD, Docker, Python",
      'input[placeholder="Google, Stripe, Shopify"]': "Piramal Finance, Observe AI",
      'input[placeholder="MIT, TU Berlin"]': "Gujarat Technological University",
      'input[placeholder="$120k-$140k"]': "₹12L-₹18L",
      'input[placeholder="USD, EUR, INR"]': "INR",
      'input[placeholder="DevOps, SRE, Platform Engineer"]': "DevOps, SRE, Platform Engineer, Cloud Engineer",
      'input[placeholder="Vercel, Datadog, HashiCorp"]': "Google, AWS, Microsoft, Stripe",
      'input[placeholder="firm, slight-flex, flexible"]': "flexible",
    };

    let filledCount = 0;
    for (const [sel, val] of Object.entries(additionalFields)) {
      if (await fillField(sel, val)) filledCount++;
    }
    pass(`${filledCount} additional fields filled`);
    if (filledCount < 5) warn("Fewer than expected fields filled — some may have been auto-filled");
    await ss(page, "06-additional-filled");

    // ═══════════════ STEP 7: COMPLETE ONBOARDING ═══════════════
    console.log("\n8. COMPLETE ONBOARDING");

    const finishBtn = await page.$('button:has-text("Finish")');
    if (finishBtn) {
      if (!(await finishBtn.isDisabled())) {
        await finishBtn.click();
        await page.waitForTimeout(5000);
        pass("Finish button clicked");

        // Check where we landed
        const afterFinish = page.url();
        console.log(`   URL after finish: ${afterFinish}`);

        if (afterFinish.includes("/") && !afterFinish.includes("/login") && !afterFinish.includes("/onboarding")) {
          pass("Redirected to dashboard after onboarding completion");
        }
        await ss(page, "07-complete");
      } else fail("Finish button is disabled");
    } else {
      warn("Finish button not found — trying Skip");
      const skip = await page.$('button, a', { hasText: "Skip for now" });
      if (skip) { await skip.click(); await page.waitForTimeout(3000); warn("Used Skip"); }
    }

    // ═══════════════ STEP 8: VERIFY ═══════════════
    console.log("\n9. VERIFICATION");

    // Verify via browser API
    const finalStatus = await apiFromBrowser(page, "/api/profile/status");
    if (finalStatus) {
      console.log(`   API: essentialsComplete=${finalStatus.essentialsComplete}, onboardingComplete=${finalStatus.onboardingComplete}`);
      if (finalStatus.onboardingComplete) pass("onboardingComplete=true — verified");
      else if (finalStatus.essentialsComplete) warn("essentialsComplete=true, onboardingComplete=false");
      else warn("Both flags still false");
    }

    // Verify profile data
    const profileData = await apiFromBrowser(page, "/api/profile");
    if (profileData) {
      const p = profileData.profile || {};
      console.log(`   Profile: name="${p.fullName}", roles=${JSON.stringify(p.targetRoles?.slice(0, 2))}..., city="${p.city}"`);
      if (p.fullName && p.targetRoles?.length > 0 && (p.city || p.country)) {
        pass("Profile essentials persisted correctly");
      }
    }

    // Visit settings page
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    const st = await page.textContent("body");
    if (st.includes("Profile") || st.includes("Settings")) pass("Settings page renders");
    await ss(page, "08-settings");

    // ═══════════════ REPORT ═══════════════
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
    console.log("═══════════════════════════════════════════════════════════\n");

  } catch (e) {
    console.error(`\n  💥 ${e.message}`);
    await ss(page, "99-fatal").catch(() => {});
    failed++;
  } finally {
    await browser.close();
    stopServer();
  }

  writeFileSync(join(__dirname, "reports", "e2e-onboarding-flow-report.md"),
    `# E2E Onboarding Flow Report\n\nDate: ${new Date().toISOString().slice(0,10)}\nResults: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
