import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";
import { requireUserId } from "@/lib/auth";
import { loadProfileForUser } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { runNode } from "@/lib/run-node";
import { getJd } from "@/lib/jd-store";
import { runTask } from "../../../../lib-ai/run.mjs";
import { buildTailorCvJson } from "../../../../lib-ai/tasks/tailor-cv-json.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function sanitizePart(s: string): string {
  return s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Returns the next available versioned filename inside `resumesDir`. */
function nextVersionedFilename(
  suffix: string,
  resumesDir: string
): { filename: string; version: number } {
  const base = `Uday_Varmora_${suffix}_Resume`;
  if (!fs.existsSync(path.join(resumesDir, `${base}.pdf`))) {
    return { filename: `${base}.pdf`, version: 1 };
  }
  let v = 2;
  while (fs.existsSync(path.join(resumesDir, `${base}_v${v}.pdf`))) {
    v++;
  }
  return { filename: `${base}_v${v}.pdf`, version: v };
}

/** Path to the latest existing version's .content.json for a suffix, or null.
 *  Lets an "update" build on the most recent version instead of from scratch. */
function latestContentSidecar(suffix: string, resumesDir: string): string | null {
  if (!fs.existsSync(resumesDir)) return null;
  const base = `Uday_Varmora_${suffix}_Resume`;
  let latestVersion = 0;
  let latestSidecar: string | null = null;
  if (fs.existsSync(path.join(resumesDir, `${base}.pdf`))) {
    latestVersion = 1;
    latestSidecar = `${base}.content.json`;
  }
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_v(\\d+)\\.pdf$`);
  for (const f of fs.readdirSync(resumesDir)) {
    const m = f.match(re);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v > latestVersion) {
        latestVersion = v;
        latestSidecar = `${base}_v${v}.content.json`;
      }
    }
  }
  if (!latestSidecar) return null;
  const p = path.join(resumesDir, latestSidecar);
  return fs.existsSync(p) ? p : null;
}

function buildFilenameSuffix(company?: string, role?: string): string {
  const c = sanitizePart(company || "");
  const r = sanitizePart(role || "");

  if (!c && !r) return "Tailored";

  // Always: Company (up to 3 words) + Role (up to 3 words).
  // Never drop company even when scraped data has company == role (e.g. Naukri
  // stores the full job-title string in both fields). A slightly redundant name
  // is better than a name missing the company.
  const cPart = c ? c.split("_").slice(0, 3).join("_") : "";
  const rPart = r ? r.split("_").slice(0, 3).join("_") : "";
  if (cPart && rPart) return `${cPart}_${rPart}`;
  return cPart || rPart;
}

export async function POST(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: { jd?: string; url?: string; company?: string; role?: string; instructions?: string; subdir?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  let jd = (body.jd || "").trim();

  // Recover the FULL job description from the per-URL cache. The frontend may send
  // only a short Role/Company/Location header (e.g. a stale bundle, or a job with
  // no JD box). If a real JD was captured at add-time, it must win — otherwise the
  // JD-gated Tier-2 tailoring (Datadog/ELK/OpenShift…) never fires. We keep any
  // header the caller sent and append the stored JD when the body's JD is stubby.
  const jobUrl = (body.url || "").trim();
  if (jobUrl) {
    const stored = getJd(jobUrl);
    if (stored?.jd && stored.jd.trim().length > jd.length) {
      jd = jd ? `${jd}\n\n${stored.jd.trim()}` : stored.jd.trim();
    }
  }
  if (!jd) return NextResponse.json({ error: "jd required" }, { status: 400 });

  const root = projectRoot();
  const suffix = buildFilenameSuffix(body.company, body.role);
  // Default save dir is output/resumes/<userId>/. Callers (e.g. the hiring-post flow)
  // may route into a separate folder via `subdir` — sanitized to a single safe segment.
  const safeSubdir = (body.subdir || "resumes").replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 40) || "resumes";
  const resumesDir = path.join(root, "output", safeSubdir, uid);

  // If a version of this resume already exists, load its tailored content so the
  // AI UPDATES the latest version (preserving prior refinements) rather than
  // re-tailoring from scratch. First-time generation has no sidecar → from scratch.
  let baseContent: Record<string, unknown> | null = null;
  const baseSidecar = latestContentSidecar(suffix, resumesDir);
  if (baseSidecar) {
    try {
      const saved = JSON.parse(fs.readFileSync(baseSidecar, "utf8"));
      baseContent = (saved.content as Record<string, unknown>) ?? null;
    } catch {
      /* corrupt/absent sidecar → tailor from scratch */
    }
  }

  // 1. Ask AI for a tailored content JSON (update the latest version if one exists)
  const profile = await loadProfileForUser(uid);
  const userContext = {
    fullName: profile.name,
    email: "",
    phone: "",
    linkedinUrl: profile.linkedin,
    githubUrl: profile.github,
    city: profile.city,
    country: profile.country,
    cvMarkdown: "",
    targetRoles: profile.targetRoles,
    superpowers: profile.stack,
    archetypes: "",
  };
  const { system, prompt } = buildTailorCvJson(jd, body.instructions || "", baseContent, userContext);
  let rawText: string;
  try {
    const r = await runTask("tailor_cv_json", { system, prompt, maxOutputTokens: 8192 });
    rawText = r.text ?? "";
  } catch (err) {
    return NextResponse.json({ error: `AI call failed: ${err}` }, { status: 502 });
  }

  const raw = extractJson(rawText);
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: `AI returned invalid JSON: ${err}`, snippet: raw.slice(0, 200) },
      { status: 500 }
    );
  }

  // Build filename: Uday_Varmora_<Company>_<Role>_Resume
  content.filenameSuffix = suffix;

  // 2. Write content JSON
  const contentPath = path.join(
    root,
    "uday-data/resume-system/content/_studio_draft.json"
  );
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + "\n", "utf8");

  // 3. Build docx + PDF via resume-builder
  const result = await runNode(
    ["uday-data/resume-system/build.js", contentPath],
    { timeout: 120_000 }
  );
  if (result.code !== 0) {
    return NextResponse.json(
      { error: `build.js exited ${result.code}`, stderr: result.stderr, stdout: result.stdout },
      { status: 500 }
    );
  }

  // 4. Find the PDF build.js produced
  const buildName = `Uday_Varmora_${suffix}_Resume.pdf`;
  const buildPath = path.join(root, `output/${buildName}`);
  if (!fs.existsSync(buildPath)) {
    return NextResponse.json(
      { error: "PDF was not produced (LibreOffice missing?)", stdout: result.stdout },
      { status: 500 }
    );
  }

  // 5. Save a versioned copy to output/resumes/<userId>/ + a sidecar for company/role metadata
  fs.mkdirSync(resumesDir, { recursive: true });
  const { filename: savedName, version: savedVersion } = nextVersionedFilename(suffix, resumesDir);
  fs.copyFileSync(buildPath, path.join(resumesDir, savedName));
  const metaPath = path.join(resumesDir, savedName.replace(/\.pdf$/, ".meta.json"));
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ company: body.company || "", role: body.role || "", createdAt: new Date().toISOString() }, null, 2)
  );

  // Sidecar with the tailored content + JD so the QA pass (POST /api/resume-qa)
  // can review this exact resume later without re-running the tailoring AI.
  const contentSidecar = path.join(resumesDir, savedName.replace(/\.pdf$/, ".content.json"));
  fs.writeFileSync(
    contentSidecar,
    JSON.stringify({ content, jd, company: body.company || "", role: body.role || "" }, null, 2)
  );

  // Track in Prisma as the per-user source of truth.
  await prisma.resume.create({
    data: {
      userId: uid,
      filename: savedName,
      company: body.company || "",
      role: body.role || "",
      version: savedVersion,
    },
  });

  const pdf = fs.readFileSync(buildPath);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildName}"`,
      "X-Saved-Filename": savedName,
      "X-Saved-Version": String(savedVersion),
    },
  });
}
