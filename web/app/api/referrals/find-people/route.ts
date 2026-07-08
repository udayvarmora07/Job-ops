import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { FILES, projectRoot } from "@/lib/paths";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheKey } from "@/lib/cache";

/** Ordered list of Apify tokens for failover: APIFY_TOKEN, APIFY_TOKEN_2, _3, ...
 *  Read from the environment, falling back to the repo-root .env file (Next runs
 *  from web/ and won't auto-load the parent .env). The lookup tries them in order
 *  and only advances to the next one when the previous fails. */
function getApifyTokens(): string[] {
  // Probe a generous number of suffixes so adding _4, _5 later "just works".
  const names = ["APIFY_TOKEN", ...Array.from({ length: 9 }, (_, i) => `APIFY_TOKEN_${i + 2}`)];

  let envRaw = "";
  try {
    envRaw = fs.readFileSync(path.join(projectRoot(), ".env"), "utf8");
  } catch {
    /* no .env file — rely on process.env only */
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
  // De-dup while preserving order (in case the same token is set twice).
  const seen: Record<string, true> = {};
  return tokens.filter((t) => (seen[t] ? false : (seen[t] = true)));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** First quoted list item under a YAML anchor key (e.g. past_companies:). */
function firstUnder(raw: string, anchor: string): string | null {
  const lines = raw.split("\n");
  const i = lines.findIndex((l) => new RegExp(`^\\s*${anchor}:\\s*$`).test(l));
  if (i < 0) return null;
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^\s*-\s*"?([^"\n]+?)"?\s*$/);
    if (m && /^\s/.test(lines[j])) return m[1].trim();
    if (lines[j].trim() && !/^\s/.test(lines[j])) break;
  }
  return null;
}

/** The user's warm-path background from their UserProfile. */
async function loadBackground(userId: string): Promise<{ pastCompany: string | null; school: string | null; pastCompanies: string[]; schools: string[] }> {
  const up = await prisma.userProfile.findUnique({ where: { userId } });
  if (!up) return { pastCompany: null, school: null, pastCompanies: [], schools: [] };

  const pastCompanies = Array.isArray(up.pastCompanies) ? up.pastCompanies as string[] : [];
  const schools = Array.isArray(up.schools) ? up.schools as string[] : [];
  return {
    pastCompany: pastCompanies[0] || null,
    school: schools[0] || null,
    pastCompanies,
    schools,
  };
}

// Off-account LinkedIn people search (no login/cookies; runs on Apify infra).
const ACTOR = "fabri-lab~linkedin-public-search-lead-extractor";
const MAX = 6; // hard cap on billed results per lookup (~$0.001 each)

type Raw = {
  fullName?: string;
  firstName?: string;
  headline?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  profileUrl?: string;
  url?: string;
  about?: string;
  confidence?: number;
};

/**
 * POST /api/referrals/find-people
 * body: { company, role?, keywords?, pastCompany?, school?, currentTitles?: string[] }
 * Returns real public LinkedIn profiles matching the referral persona.
 */
export async function POST(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  const tokens = getApifyTokens();
  if (!tokens.length) {
    return NextResponse.json(
      { error: "APIFY_TOKEN not set in .env. Get one at Apify console → Settings → API & Integrations." },
      { status: 400 }
    );
  }

  let body: {
    company?: string;
    role?: string;
    keywords?: string;
    persona?: string;
    pastCompany?: string;
    school?: string;
    currentTitles?: string[];
    refresh?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const company = (body.company || "").trim();
  if (!company) return NextResponse.json({ error: "company required" }, { status: 400 });

  // Cache by user + company + persona + keywords so a re-open / re-click costs no Apify run.
  const key = cacheKey("find_people", uid, company, body.persona || "", body.keywords || "");
  if (!body.refresh) {
    const hit = cacheGet(key);
    if (hit) return NextResponse.json({ cached: true, ...(hit.payload as object) });
  }

  // Build the actor input from the persona. searchQuery carries the AI keywords;
  // structured filters sharpen it (current company + optional past company / school).
  const input: Record<string, unknown> = {
    profileScraperMode: "Short",
    searchQuery: (body.keywords || `${company} ${body.role || ""}`).trim(),
    currentCompanyUrls: [company],
    takePages: 1,
    preferBuiltinSearch: false,
  };
  if (body.currentTitles?.length) input.currentJobTitles = body.currentTitles;

  // Apply the user's warm-path background based on the persona of this target:
  // ex-colleague → past company; alumni → school. Explicit body values win.
  const persona = (body.persona || "").toLowerCase();
  const bg = await loadBackground(uid);
  const pastCompany =
    body.pastCompany || (/colleague|ex-|former|past|coworker/.test(persona) ? bg.pastCompany : null);
  const school =
    body.school || (/alumn|universit|college|school|grad/.test(persona) ? bg.school : null);
  const applied: string[] = [];
  if (pastCompany) {
    input.pastCompanyUrls = [pastCompany];
    applied.push(`past: ${pastCompany}`);
  }
  if (school) {
    input.schoolUrls = [school];
    applied.push(`school: ${school}`);
  }

  // Try each token in order; only advance to the next when the current one fails
  // (HTTP error or thrown network error). The first success returns immediately.
  let lastError = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(
          token
        )}&maxItems=${MAX}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!res.ok) {
        lastError = `Apify run failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`;
        continue; // token rejected / out of credit → fall through to the next one
      }
      const rows: Raw[] = await res.json();
      const people = (Array.isArray(rows) ? rows : [])
        .filter((r) => r && (r.linkedinUrl || r.profileUrl || r.url))
        .slice(0, MAX)
        .map((r) => ({
          name: r.fullName || [r.firstName].filter(Boolean).join(" ") || "(name on profile)",
          firstName: r.firstName || (r.fullName || "").split(" ")[0] || "there",
          headline: r.headline || r.jobTitle || "",
          url: r.linkedinUrl || r.profileUrl || r.url || "",
          confidence: r.confidence ?? null,
        }));

      const payload = {
        company,
        count: people.length,
        people,
        appliedFilters: applied,
        tokenIndex: i, // which token (0-based) succeeded — handy for debugging
      };
      cacheSet(key, "find_people", `${company}|${body.persona || ""}`, payload);
      return NextResponse.json({ cached: false, ...payload });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // network/exception → try the next token
    }
  }

  // Every token failed.
  return NextResponse.json(
    { error: `All ${tokens.length} Apify token(s) failed. Last error: ${lastError}` },
    { status: 502 }
  );
}
