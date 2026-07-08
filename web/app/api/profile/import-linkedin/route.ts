import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectRoot } from "@/lib/paths";
import { runTask } from "../../../../../lib-ai/run.mjs";
import { buildParseResume, parseResumeJson } from "../../../../../lib-ai/tasks/parse-resume.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Reuse the Apify token-failover pattern from find-people/route.ts to scrape
 * a public LinkedIn profile, then AI-normalize → pre-fill the wizard.
 */
function getApifyTokens(): string[] {
  const names = ["APIFY_TOKEN", ...Array.from({ length: 9 }, (_, i) => `APIFY_TOKEN_${i + 2}`)];
  let envRaw = "";
  try {
    envRaw = fs.readFileSync(path.join(projectRoot(), ".env"), "utf8");
  } catch {
    /* no .env — rely on process.env */
  }
  const tokens: string[] = [];
  for (const name of names) {
    const fromEnv = process.env[name]?.trim();
    if (fromEnv) {
      tokens.push(fromEnv);
      continue;
    }
    const m = envRaw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, "m"));
    if (m && m[1].trim()) tokens.push(m[1].trim());
  }
  const seen: Record<string, true> = {};
  return tokens.filter((t) => (seen[t] ? false : (seen[t] = true)));
}

const ACTOR = "fabri-lab~linkedin-public-search-lead-extractor";

/**
 * POST /api/profile/import-linkedin
 * body: { url } — a public LinkedIn profile URL (linkedin.com/in/...)
 *
 * Scrapes the profile via Apify, extracts the text, runs the parse_resume AI
 * task to normalize it into structured fields, and returns them to pre-fill
 * the wizard. Best-effort — reliability varies, clearly labeled as optional.
 */
export async function POST(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const url = (body.url || "").trim();
  if (!url || !/linkedin\.com\/in\//i.test(url)) {
    return NextResponse.json(
      { error: "A valid LinkedIn profile URL (linkedin.com/in/...) is required." },
      { status: 400 },
    );
  }

  const tokens = getApifyTokens();
  if (!tokens.length) {
    return NextResponse.json(
      { error: "APIFY_TOKEN not set. LinkedIn import requires an Apify token." },
      { status: 400 },
    );
  }

  // Scrape the profile via Apify — try each token in order.
  let profileText = "";
  let lastError = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&maxItems=1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileScraperMode: "Full",
            searchQuery: url,
            takePages: 1,
            preferBuiltinSearch: false,
          }),
        },
      );
      if (!res.ok) {
        lastError = `Apify run failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`;
        continue;
      }
      const rows = await res.json();
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!row) {
        lastError = "No profile data returned from Apify.";
        continue;
      }

      // Assemble text from the scraped profile fields
      const parts: string[] = [];
      if (row.fullName) parts.push(`Name: ${row.fullName}`);
      if (row.headline) parts.push(`Headline: ${row.headline}`);
      if (row.jobTitle) parts.push(`Current Title: ${row.jobTitle}`);
      if (row.about) parts.push(`About: ${row.about}`);
      if (row.email) parts.push(`Email: ${row.email}`);
      if (row.location) parts.push(`Location: ${row.location}`);
      if (row.linkedinUrl) parts.push(`LinkedIn: ${row.linkedinUrl}`);
      // Experience entries
      if (Array.isArray(row.experience)) {
        parts.push("Experience:");
        for (const exp of row.experience) {
          parts.push(
            `- ${exp.title || ""} at ${exp.company || ""} (${exp.startDate || ""} - ${exp.endDate || "Present"})`,
          );
          if (exp.description) parts.push(`  ${exp.description}`);
        }
      }
      // Education entries
      if (Array.isArray(row.education)) {
        parts.push("Education:");
        for (const edu of row.education) {
          parts.push(`- ${edu.school || ""} — ${edu.degree || ""} ${edu.field || ""}`);
        }
      }
      // Skills
      if (Array.isArray(row.skills)) {
        parts.push(`Skills: ${row.skills.join(", ")}`);
      }

      profileText = parts.join("\n");
      break; // success
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!profileText.trim()) {
    return NextResponse.json(
      { error: `Could not scrape the LinkedIn profile. ${lastError}` },
      { status: 502 },
    );
  }

  // AI-normalize the scraped text into structured fields
  let rawText: string;
  try {
    const { system, prompt } = buildParseResume(profileText);
    const r = await runTask("parse_resume", { system, prompt, maxOutputTokens: 8192 });
    rawText = r.text ?? "";
  } catch (err) {
    return NextResponse.json(
      { error: `AI normalization failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const parsed = parseResumeJson(rawText);
  if (!parsed) {
    return NextResponse.json(
      { error: "AI returned invalid JSON. Please try the manual wizard instead." },
      { status: 502 },
    );
  }

  // Ensure linkedinUrl is set from the input URL
  if (!parsed.linkedinUrl) parsed.linkedinUrl = url;

  // Persist cvMarkdown to the user's profile
  try {
    await prisma.userProfile.update({
      where: { userId: uid },
      data: {
        cvMarkdown: parsed.cvMarkdown || profileText,
        cvStructured: parsed as object,
        linkedinUrl: url,
      },
    });
  } catch {
    await prisma.userProfile.upsert({
      where: { userId: uid },
      update: {
        cvMarkdown: parsed.cvMarkdown || profileText,
        cvStructured: parsed as object,
        linkedinUrl: url,
      },
      create: {
        userId: uid,
        cvMarkdown: parsed.cvMarkdown || profileText,
        cvStructured: parsed as object,
        linkedinUrl: url,
      },
    });
  }

  return NextResponse.json({
    parsed,
    source: "linkedin",
    warning: "LinkedIn import is best-effort and may not capture all profile data.",
  });
}
