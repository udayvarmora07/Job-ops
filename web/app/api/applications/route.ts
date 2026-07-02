import { NextResponse } from "next/server";
import fs from "fs";
import nodePath from "path";
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

export async function GET() {
  return NextResponse.json({ applications: parseApplications() });
}

/**
 * POST /api/applications  body: { company, role?, url?, status? }
 * Creates a new tracker entry (status defaults to "Applied") via the
 * TSV → merge-tracker.mjs flow. Used by the "Applied" button in the
 * job dialog when no existing tracker record exists for this job.
 */
export async function POST(req: Request) {
  let body: { company?: string; role?: string; url?: string; status?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const company = String(body.company || "").trim();
  const role    = String(body.role    || "").trim();
  const status  = STATES.includes(body.status || "") ? body.status! : "Applied";
  if (!company) return NextResponse.json({ error: "company required" }, { status: 400 });

  const date = new Date().toISOString().slice(0, 10);

  // Next sequential number — max existing + 1.
  const apps  = parseApplications();
  const maxN  = apps.reduce((m, a) => Math.max(m, parseInt(a.num, 10) || 0), 0);
  const num   = String(maxN + 1).padStart(3, "0");
  const slug  = slugify(company);
  const note  = body.url ? `Applied from ${body.url}` : "Applied via dashboard";

  // TSV: num  date  company  role  status  score  pdf  report  notes
  const tsv = [num, date, company, role || "—", status, "—", "❌", "—", note].join("\t");

  const addDir = nodePath.join(projectRoot(), "batch", "tracker-additions");
  fs.mkdirSync(addDir, { recursive: true });
  fs.writeFileSync(nodePath.join(addDir, `${num}-${slug}.tsv`), tsv + "\n", "utf8");

  const merge = await runNode(["merge-tracker.mjs"], { timeout: 30_000 });
  if (merge.code !== 0) {
    return NextResponse.json({ error: merge.stderr || "merge-tracker failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, num, company, role, status });
}

/**
 * PATCH /api/applications  body: { num: string, status: string }
 * Updates the Status cell of an existing tracker row in data/applications.md.
 */
export async function PATCH(req: Request) {
  let body: { num?: string; status?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const num    = String(body.num    || "").trim();
  const status = String(body.status || "").trim();
  if (!num || !status)          return NextResponse.json({ error: "num and status required" }, { status: 400 });
  if (!STATES.includes(status)) return NextResponse.json({ error: `invalid status. Use: ${STATES.join(", ")}` }, { status: 400 });

  const filePath = FILES.applications();
  let raw: string;
  try { raw = fs.readFileSync(filePath, "utf8"); }
  catch { return NextResponse.json({ error: "applications.md not found" }, { status: 404 }); }

  const lines = raw.split("\n");
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const cells = lines[i].split("|");
    if (cells.length < 8 || cells[1].trim() !== num) continue;
    cells[6] = ` ${status} `;
    lines[i] = cells.join("|");
    changed = true;
    break;
  }

  if (!changed) return NextResponse.json({ error: `no row with # ${num}` }, { status: 404 });
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return NextResponse.json({ ok: true, num, status });
}
