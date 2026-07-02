import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { projectRoot } from "@/lib/paths";
import { runNode } from "@/lib/run-node";
import { runTask } from "../../../../lib-ai/run.mjs";
import { buildEvaluateJob } from "../../../../lib-ai/tasks/evaluate-job.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const slugify = (s: string) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";

function field(block: string, key: string): string {
  const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : "";
}

export async function POST(req: Request) {
  let body: { jd?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const jd = (body.jd || "").trim();
  if (!jd) return NextResponse.json({ error: "jd required" }, { status: 400 });

  const root = projectRoot();
  const date = new Date().toISOString().slice(0, 10);
  let reservedNum: string | null = null;

  try {
    const { system, prompt } = buildEvaluateJob(jd);
    const r = await runTask("evaluate_job", { system, prompt });
    const text: string = r.text;

    const sum = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
    const block = sum ? sum[1] : "";
    const company = field(block, "COMPANY") || "Unknown";
    const role = field(block, "ROLE") || "Unknown";
    const score = field(block, "SCORE") || "";
    const slug = slugify(company);

    const reserve = await runNode(["reserve-report-num.mjs"], { timeout: 15_000 });
    reservedNum = reserve.stdout.trim().split(/\s+/).pop() || null;
    if (!reservedNum || !/^\d{3}$/.test(reservedNum)) {
      throw new Error(`could not reserve report number (got "${reserve.stdout.trim()}")`);
    }
    const num = reservedNum;

    const reportName = `${num}-${slug}-${date}.md`;
    fs.writeFileSync(path.join(root, "reports", reportName), text, "utf8");

    const scoreNum = score && score !== "?" ? parseFloat(score) : null;

    await prisma.report.upsert({
      where: { num: parseInt(num, 10) },
      update: { content: text, score: scoreNum },
      create: {
        num: parseInt(num, 10),
        company,
        role,
        score: scoreNum,
        content: text,
      },
    });

    const addDir = path.join(root, "batch", "tracker-additions");
    fs.mkdirSync(addDir, { recursive: true });
    const scoreCell = score && score !== "?" ? `${score}/5` : "N/A";
    const tsv = [
      num, date, company, role, "Evaluated", scoreCell, "❌",
      `[${num}](reports/${reportName})`,
      "Evaluated via web dashboard",
    ].join("\t");
    fs.writeFileSync(path.join(addDir, `${num}-${slug}.tsv`), tsv + "\n", "utf8");

    const merge = await runNode(["merge-tracker.mjs"], { timeout: 30_000 });
    await runNode(["reserve-report-num.mjs", "--release", num], { timeout: 15_000 });
    reservedNum = null;

    await prisma.application.upsert({
      where: { num: parseInt(num, 10) },
      update: { score: scoreNum, status: "Evaluated" },
      create: {
        num: parseInt(num, 10),
        date: new Date(date),
        company,
        role,
        score: scoreNum,
        status: "Evaluated",
        reportUrl: `reports/${reportName}`,
        notes: "Evaluated via web dashboard",
      },
    });

    return NextResponse.json({
      ok: true, num, company, role,
      score: scoreCell,
      reportFile: `reports/${reportName}`,
      reportId: num,
      merged: merge.code === 0,
      report: text,
    });
  } catch (err) {
    if (reservedNum) {
      await runNode(["reserve-report-num.mjs", "--release", reservedNum], { timeout: 15_000 }).catch(() => {});
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
