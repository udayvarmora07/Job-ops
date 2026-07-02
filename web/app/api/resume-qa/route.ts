import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";
import { runTask } from "../../../../lib-ai/run.mjs";
import { buildResumeQa, parseResumeQa } from "../../../../lib-ai/tasks/resume-qa.mjs";
import { computeAtsScore } from "../../../../lib-ai/ats-score.mjs";
import type { ResumeQa } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // QA is a full model pass

function resumesDir() {
  return path.join(projectRoot(), "output/resumes");
}

/** Resolve the .content.json / .qa.json sidecar paths for a saved PDF filename. */
function sidecars(file: string) {
  const base = file.replace(/\.pdf$/, "");
  return {
    content: path.join(resumesDir(), `${base}.content.json`),
    qa: path.join(resumesDir(), `${base}.qa.json`),
  };
}

/** GET /api/resume-qa?file=<pdf name> → the cached QA result (or 404). */
export async function GET(req: NextRequest) {
  const file = new URL(req.url).searchParams.get("file") || "";
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  const { qa } = sidecars(path.basename(file));
  if (!fs.existsSync(qa)) return NextResponse.json({ qa: null });
  try {
    return NextResponse.json({ qa: JSON.parse(fs.readFileSync(qa, "utf8")) });
  } catch {
    return NextResponse.json({ qa: null });
  }
}

/**
 * POST /api/resume-qa
 * body: { file?: string, content?: object|string, jd?: string }
 * Runs the multi-perspective QA pass and caches it to <file>.qa.json. Returns { qa }.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const file: string = body.file ? path.basename(String(body.file)) : "";

  let content = body.content;
  let jd: string = body.jd || "";

  // If only a filename was given, load the content sidecar written at generation.
  if (!content && file) {
    const { content: cPath } = sidecars(file);
    if (fs.existsSync(cPath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(cPath, "utf8"));
        content = saved.content ?? saved;
        if (!jd) jd = saved.jd || "";
      } catch {
        /* fall through */
      }
    }
  }

  if (!content) {
    return NextResponse.json(
      { error: "no resume content (pass content, or a file with a .content.json sidecar)" },
      { status: 400 }
    );
  }

  try {
    const { system, prompt } = buildResumeQa({ resume: content, jd });
    // temperature 0: the QA verdict/issues should be as reproducible as possible.
    // 8192 (not 4096): reasoning models spend tokens thinking before the JSON,
    // and a long issue list can overflow a tight cap and truncate the output.
    const { text } = await runTask("resume_qa", { system, prompt, temperature: 0, maxOutputTokens: 8192 });
    const qa = parseResumeQa(text) as ResumeQa;

    // Deterministic ATS score: an ATS screens by JD keyword coverage, so compute
    // that in code (reproducible, explainable) and make it the authoritative
    // "ATS X/100". Fall back to the model's holistic score only when the JD is
    // too sparse to yield keywords. The model's number is kept as modelScore.
    const ats = computeAtsScore(jd, content);
    qa.ats = ats;
    if (ats.score !== null) {
      qa.modelScore = qa.score;
      qa.score = ats.score;
    }

    if (file) {
      const { qa: qaPath } = sidecars(file);
      try {
        fs.writeFileSync(qaPath, JSON.stringify(qa, null, 2));
      } catch {
        /* non-fatal: still return the result */
      }
    }
    return NextResponse.json({ qa });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
