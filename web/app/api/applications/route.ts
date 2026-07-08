import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import nodePath from "path";
import { requireUserId } from "@/lib/auth";
import { parseApplications } from "@/lib/parsers";
import { FILES, projectRoot } from "@/lib/paths";
import { runNode } from "@/lib/run-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATES = [
  "Evaluated", "Applied", "Responded", "Interview",
  "Offer", "Rejected", "Discarded", "SKIP",
];

const slugify = (s: string) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

export async function GET(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  const apps = await prisma.application.findMany({
    where: { userId: uid },
    orderBy: { num: "desc" },
  });
  return NextResponse.json({
    applications: apps.map((a) => ({
      num: String(a.num).padStart(3, "0"),
      date: a.date.toISOString().slice(0, 10),
      company: a.company,
      role: a.role,
      score: a.score ? `${a.score}/5` : "—",
      scoreNum: a.score,
      status: a.status,
      pdf: !!a.pdfUrl,
      reportNum: a.reportUrl
        ? (a.reportUrl.match(/\d{3}/)?.[0] || null)
        : null,
      notes: a.notes || "",
    })),
  });
}

export async function POST(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: { company?: string; role?: string; url?: string; status?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const company = String(body.company || "").trim();
  const role = String(body.role || "").trim();
  const status = STATES.includes(body.status || "") ? body.status! : "Applied";
  if (!company) return NextResponse.json({ error: "company required" }, { status: 400 });

  const date = new Date().toISOString().slice(0, 10);

  const maxNum = await prisma.application.findFirst({ orderBy: { num: "desc" } });
  const num = (maxNum?.num ?? 0) + 1;
  const slug = slugify(company);
  const note = body.url ? `Applied from ${body.url}` : "Applied via dashboard";

  // Persist to Prisma as the per-user source of truth.
  await prisma.application.create({
    data: {
      num,
      date: new Date(date),
      company,
      role: role || "—",
      status,
      userId: uid,
      notes: note,
    },
  });

  const tsv = [num, date, company, role || "—", status, "—", "❌", "—", note].join("\t");

  const addDir = nodePath.join(projectRoot(), "batch", "tracker-additions");
  fs.mkdirSync(addDir, { recursive: true });
  fs.writeFileSync(nodePath.join(addDir, `${String(num).padStart(3, "0")}-${slug}.tsv`), tsv + "\n", "utf8");

  const merge = await runNode(["merge-tracker.mjs"], { timeout: 30_000 });
  if (merge.code !== 0) {
    return NextResponse.json({ error: merge.stderr || "merge-tracker failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, num, company, role, status });
}

export async function PATCH(req: Request) {
  let body: { num?: string; status?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const num = parseInt(String(body.num || "").trim(), 10);
  const status = String(body.status || "").trim();
  if (!num || !status) return NextResponse.json({ error: "num and status required" }, { status: 400 });
  if (!STATES.includes(status)) return NextResponse.json({ error: `invalid status. Use: ${STATES.join(", ")}` }, { status: 400 });

  const app = await prisma.application.updateMany({ where: { num }, data: { status } });
  if (app.count === 0) return NextResponse.json({ error: `no row with # ${num}` }, { status: 404 });

  return NextResponse.json({ ok: true, num, status });
}
