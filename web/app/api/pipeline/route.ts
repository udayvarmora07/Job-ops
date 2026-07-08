import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { FILES } from "@/lib/paths";
import { detectPlatform } from "./detect-platform";
import { fetchJob, JobFetchError } from "@/lib/job-fetch";
import { saveJd, getJd } from "@/lib/jd-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  const jdUrl = new URL(req.url).searchParams.get("jd");
  if (jdUrl) {
    const entry = getJd(jdUrl);
    return NextResponse.json({ jd: entry?.jd || "", entry: entry || null });
  }

  const items = await prisma.pipelineItem.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
  });
  const pending = items
    .filter((i) => i.status === "pending")
    .map((i) => {
      const stored = getJd(i.url);
      return {
        url: i.url,
        company: i.company || "",
        role: i.title || "",
        hasJd: !!stored && stored.jd.trim().length > 0,
      };
    });

  const processedCount = items.filter((i) => i.status === "done").length;
  return NextResponse.json({ pending, processedCount });
}

function appendScanHistory(url: string, role: string, company: string, platform: string, location: string) {
  const fs = require("fs");
  const path = FILES.scanHistory();
  const header = "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n";
  if (!fs.existsSync(path)) fs.writeFileSync(path, header, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  const line = `${url}\t${date}\t${platform}\t${role}\t${company}\tmanually-added\t${location}\n`;
  fs.appendFileSync(path, line, "utf8");
}

async function addToPipeline(url: string, company: string, role: string, location: string, userId: string) {
  const existing = await prisma.pipelineItem.findUnique({ where: { url } });
  if (existing) return { duplicate: true };

  await prisma.pipelineItem.create({
    data: { url, title: role, company, status: "pending", userId },
  });

  appendScanHistory(url, role, company, `manual-${detectPlatform(url)}`, location);
  return { duplicate: false };
}

export async function POST(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: {
    url?: string; company?: string; role?: string; location?: string;
    jd?: string; force?: boolean;
  } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const platform = detectPlatform(url);
  const manualJd = (body.jd || "").trim();
  let company = (body.company || "").trim();
  let role = (body.role || "").trim();
  let location = (body.location || "").trim();

  if (manualJd.length >= 120) {
    saveJd({ url, title: role, company, location, jd: manualJd, source: "manual", platform, fetchedAt: new Date().toISOString() });
    const { duplicate } = await addToPipeline(url, company, role, location, uid);
    return NextResponse.json({ ok: true, duplicate, jdSource: "manual", jdChars: manualJd.length, company, role, location });
  }

  try {
    const job = await fetchJob(url);
    company = company || job.company;
    role = role || job.title;
    location = location || job.location;
    saveJd({ url, title: job.title, company, location, jd: job.jd, source: job.source, platform: job.platform, fetchedAt: new Date().toISOString() });
    const { duplicate } = await addToPipeline(url, company, role, location, uid);
    return NextResponse.json({ ok: true, duplicate, jdSource: job.source, jdChars: job.jd.length, company, role, location });
  } catch (err) {
    const isFetchErr = err instanceof JobFetchError;
    const message = isFetchErr ? err.message : `Fetch failed: ${(err as Error).message}`;
    if (body.force) {
      const { duplicate } = await addToPipeline(url, company, role, location, uid);
      return NextResponse.json({ ok: true, duplicate, warning: message, jdSource: "none", jdChars: 0 });
    }
    return NextResponse.json({ error: message, code: isFetchErr ? err.code : "fetch_error", platform, needsManualJd: true }, { status: 422 });
  }
}

export async function DELETE(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const result = await prisma.pipelineItem.deleteMany({ where: { url, userId: uid } });
  if (result.count === 0) return NextResponse.json({ error: "URL not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
