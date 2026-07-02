import { NextResponse } from "next/server";
import fs from "fs";
import { FILES } from "@/lib/paths";
import { detectPlatform } from "./detect-platform";
import { fetchJob, JobFetchError } from "@/lib/job-fetch";
import { saveJd, getJd } from "@/lib/jd-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Headless fallback (Playwright) can take ~30s on JS-heavy boards.
export const maxDuration = 120;

function readRaw(): string {
  try {
    return fs.readFileSync(FILES.pipeline(), "utf8");
  } catch {
    return "";
  }
}

function parseLine(line: string) {
  const content = line.replace(/^- \[[ x]\]\s*/, "").trim();
  const parts = content.split(" | ");
  return {
    url: parts[0]?.trim() || "",
    company: parts[1]?.trim() || "",
    role: parts[2]?.trim() || "",
    done: /^- \[x\]/i.test(line),
  };
}

export async function GET(req: Request) {
  // ?jd=<url> → return the stored JD for a single job (used by resume/eval flows).
  const jdUrl = new URL(req.url).searchParams.get("jd");
  if (jdUrl) {
    const entry = getJd(jdUrl);
    return NextResponse.json({ jd: entry?.jd || "", entry: entry || null });
  }

  const raw = readRaw();
  const pending: { url: string; company: string; role: string; hasJd: boolean }[] = [];
  const processedCount = { n: 0 };

  for (const line of raw.split("\n")) {
    if (/^- \[ \]/.test(line)) {
      const e = parseLine(line);
      if (e.url) {
        const stored = getJd(e.url);
        pending.push({
          url: e.url,
          company: e.company,
          role: e.role,
          hasJd: !!stored && stored.jd.trim().length > 0,
        });
      }
    } else if (/^- \[x\]/i.test(line)) {
      processedCount.n++;
    }
  }

  return NextResponse.json({ pending, processedCount: processedCount.n });
}

function appendScanHistory(url: string, role: string, company: string, platform: string, location: string) {
  const path = FILES.scanHistory();
  const header = "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n";
  if (!fs.existsSync(path)) fs.writeFileSync(path, header, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  const line = `${url}\t${date}\t${platform}\t${role}\t${company}\tmanually-added\t${location}\n`;
  fs.appendFileSync(path, line, "utf8");
}

/** Append the URL to pipeline.md + scan-history. Returns { duplicate } if already present. */
function addToPipeline(url: string, company: string, role: string, location: string): { duplicate: boolean } {
  let raw = readRaw();
  if (raw.includes(url)) return { duplicate: true };

  const line = `- [ ] ${url}${company ? ` | ${company}` : ""}${role ? ` | ${role}` : ""}`;
  if (!raw.trim()) raw = "# Pipeline — Pending URLs\n\nInbox of job URLs to evaluate.\n\n";
  raw = raw.trimEnd() + "\n" + line + "\n";
  fs.writeFileSync(FILES.pipeline(), raw, "utf8");

  // Also record in scan-history so it shows in Jobs Browser with a platform badge.
  appendScanHistory(url, role, company, `manual-${detectPlatform(url)}`, location);
  return { duplicate: false };
}

export async function POST(req: Request) {
  let body: {
    url?: string;
    company?: string;
    role?: string;
    location?: string;
    /** Manually pasted JD (used when auto-fetch is blocked, e.g. Naukri). */
    jd?: string;
    /** Add even if the JD could not be fetched (stores a stub, no JD). */
    force?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const platform = detectPlatform(url);
  const manualJd = (body.jd || "").trim();
  let company = (body.company || "").trim();
  let role = (body.role || "").trim();
  let location = (body.location || "").trim();

  // ── Path A: caller supplied the JD text (manual paste) — trust it, store it. ──
  if (manualJd.length >= 120) {
    saveJd({
      url, title: role, company, location,
      jd: manualJd, source: "manual", platform,
      fetchedAt: new Date().toISOString(),
    });
    const { duplicate } = addToPipeline(url, company, role, location);
    return NextResponse.json({
      ok: true, duplicate, jdSource: "manual", jdChars: manualJd.length, company, role, location,
    });
  }

  // ── Path B: auto-fetch the complete job (JD + metadata). ──
  try {
    const job = await fetchJob(url);
    // Prefer caller-provided fields (user edits) but fall back to fetched values.
    company = company || job.company;
    role = role || job.title;
    location = location || job.location;
    saveJd({
      url, title: job.title, company, location,
      jd: job.jd, source: job.source, platform: job.platform,
      fetchedAt: new Date().toISOString(),
    });
    const { duplicate } = addToPipeline(url, company, role, location);
    return NextResponse.json({
      ok: true, duplicate, jdSource: job.source, jdChars: job.jd.length, company, role, location,
    });
  } catch (err) {
    // ── Path C: could not get the JD. Either add a stub (force) or error out. ──
    const isFetchErr = err instanceof JobFetchError;
    const message = isFetchErr ? err.message : `Fetch failed: ${(err as Error).message}`;
    if (body.force) {
      const { duplicate } = addToPipeline(url, company, role, location);
      return NextResponse.json({ ok: true, duplicate, warning: message, jdSource: "none", jdChars: 0 });
    }
    return NextResponse.json(
      { error: message, code: isFetchErr ? err.code : "fetch_error", platform, needsManualJd: true },
      { status: 422 }
    );
  }
}

export async function DELETE(req: Request) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const raw = readRaw();
  const lines = raw.split("\n");
  const filtered = lines.filter((l) => !l.includes(url));

  if (filtered.length === lines.length) {
    return NextResponse.json({ error: "URL not found" }, { status: 404 });
  }

  fs.writeFileSync(FILES.pipeline(), filtered.join("\n"), "utf8");
  return NextResponse.json({ ok: true });
}
