import { NextResponse } from "next/server";
import fs from "fs";
import { parseJobs } from "@/lib/parsers";
import { FILES } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ jobs: parseJobs() });
}

export async function DELETE(req: Request) {
  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  // Remove from scan-history.tsv
  const tsvPath = FILES.scanHistory();
  if (fs.existsSync(tsvPath)) {
    const lines = fs.readFileSync(tsvPath, "utf8").split("\n");
    const filtered = lines.filter((l) => {
      const cols = l.split("\t");
      return cols[0] !== url;
    });
    fs.writeFileSync(tsvPath, filtered.join("\n"), "utf8");
  }

  // Remove from pipeline.md
  const pipePath = FILES.pipeline();
  if (fs.existsSync(pipePath)) {
    const lines = fs.readFileSync(pipePath, "utf8").split("\n");
    const filtered = lines.filter((l) => {
      const m = l.match(/^- \[[ x]\]\s*(\S+)/i);
      return !m || m[1] !== url;
    });
    fs.writeFileSync(pipePath, filtered.join("\n"), "utf8");
  }

  return NextResponse.json({ ok: true });
}
