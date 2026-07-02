import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";
import { runNode } from "@/lib/run-node";
import { runTask } from "../../../../lib-ai/run.mjs";
import { buildEvaluateJob } from "../../../../lib-ai/tasks/evaluate-job.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

function field(block: string, key: string): string {
  const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : "";
}

/**
 * POST /api/evaluate-save  body: { jd: string }
 * Runs the A–G evaluation, then persists it like the CLI pipeline:
 *  - reserves an atomic report number,
 *  - writes reports/{num}-{slug}-{date}.md,
 *  - drops a tracker-additions TSV and runs merge-tracker.mjs,
 *  - releases the reservation sentinel.
 */
export async function POST(req: Request) {
  let body: { jd?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const jd = (body.jd || "").trim();
  if (!jd) return NextResponse.json({ error: "jd required" }, { status: 400 });

  const root = projectRoot();
  const date = new Date().toISOString().slice(0, 10);
  let reservedNum: string | null = null;

  try {
    // 1) Evaluate.
    const { system, prompt } = buildEvaluateJob(jd);
    const r = await runTask("evaluate_job", { system, prompt });
    const text: string = r.text;

    // 2) Parse the machine summary.
    const sum = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
    const block = sum ? sum[1] : "";
    const company = field(block, "COMPANY") || "Unknown";
    const role = field(block, "ROLE") || "Unknown";
    const score = field(block, "SCORE") || "";
    const slug = slugify(company);

    // 3) Reserve a report number atomically.
    const reserve = await runNode(["reserve-report-num.mjs"], { timeout: 15_000 });
    reservedNum = reserve.stdout.trim().split(/\s+/).pop() || null;
    if (!reservedNum || !/^\d{3}$/.test(reservedNum)) {
      throw new Error(`could not reserve report number (got "${reserve.stdout.trim()}")`);
    }
    const num = reservedNum;

    // 4) Write the report file.
    const reportName = `${num}-${slug}-${date}.md`;
    fs.writeFileSync(path.join(root, "reports", reportName), text, "utf8");

    // 5) Write a tracker-additions TSV and merge it in.
    const addDir = path.join(root, "batch", "tracker-additions");
    fs.mkdirSync(addDir, { recursive: true });
    const scoreCell = score && score !== "?" ? `${score}/5` : "N/A";
    const tsv = [
      num,
      date,
      company,
      role,
      "Evaluated",
      scoreCell,
      "❌",
      `[${num}](reports/${reportName})`,
      "Evaluated via web dashboard",
    ].join("\t");
    fs.writeFileSync(path.join(addDir, `${num}-${slug}.tsv`), tsv + "\n", "utf8");

    const merge = await runNode(["merge-tracker.mjs"], { timeout: 30_000 });

    // 6) Release the reservation sentinel.
    await runNode(["reserve-report-num.mjs", "--release", num], { timeout: 15_000 });
    reservedNum = null;

    return NextResponse.json({
      ok: true,
      num,
      company,
      role,
      score: scoreCell,
      reportFile: `reports/${reportName}`,
      reportId: num,
      merged: merge.code === 0,
      report: text,
    });
  } catch (err) {
    // Best-effort: release the sentinel if we reserved but failed later.
    if (reservedNum) {
      await runNode(["reserve-report-num.mjs", "--release", reservedNum], { timeout: 15_000 }).catch(
        () => {}
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
