import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePart(s: string): string {
  return s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** `01_Mastercard_PlatformEngineer` → "Mastercard Platform Engineer" */
function suffixToDisplay(suffix: string): string {
  return suffix
    .replace(/^\d+_/, "")                      // strip leading numeric prefix
    .replace(/_/g, " ")                        // underscores → spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2")      // camelCase → words
    .replace(/\s+/g, " ")
    .trim();
}

interface ResumeFile {
  name: string;
  version: number;
  url: string;
  mtime: string;
  company: string | null;
  role: string | null;
}

interface ResumeGroup {
  suffix: string;
  displayName: string;
  files: ResumeFile[];
  latestMtime: string;
  company: string | null;
  role: string | null;
}

function parseResumesDir(resumesDir: string): ResumeGroup[] {
  const all = fs.readdirSync(resumesDir).filter((f) => f.endsWith(".pdf"));
  const groups = new Map<string, ResumeFile[]>();

  for (const name of all) {
    const m = name.match(/^Uday_Varmora_(.+?)_Resume(?:_v(\d+))?\.pdf$/);
    if (!m) continue;
    const suffix = m[1];
    const version = m[2] ? parseInt(m[2], 10) : 1;
    const mtime = fs.statSync(path.join(resumesDir, name)).mtime.toISOString();

    // Read sidecar metadata if present
    let company: string | null = null;
    let role: string | null = null;
    const metaPath = path.join(resumesDir, name.replace(/\.pdf$/, ".meta.json"));
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        company = meta.company || null;
        role = meta.role || null;
      } catch { /* ignore malformed sidecar */ }
    }

    if (!groups.has(suffix)) groups.set(suffix, []);
    groups.get(suffix)!.push({ name, version, url: `/api/resumes/${encodeURIComponent(name)}`, mtime, company, role });
  }

  // Sort each group newest-version-first, then sort groups newest-mtime-first
  const result: ResumeGroup[] = [];
  groups.forEach((files, suffix) => {
    files.sort((a: ResumeFile, b: ResumeFile) => b.version - a.version);
    const latestMtime = files[0].mtime;
    // Use company/role from whichever file has it (prefer latest)
    const withMeta = files.find((f) => f.company || f.role);
    result.push({
      suffix,
      displayName: suffixToDisplay(suffix),
      files,
      latestMtime,
      company: withMeta?.company ?? null,
      role: withMeta?.role ?? null,
    });
  });
  result.sort((a, b) => b.latestMtime.localeCompare(a.latestMtime));
  return result;
}

/** GET /api/resumes — list all, or filter by company+role */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  const role = searchParams.get("role") || "";

  const resumesDir = path.join(projectRoot(), "output/resumes");
  if (!fs.existsSync(resumesDir)) {
    return NextResponse.json({ groups: [], files: [] });
  }

  // Filter mode: company + role provided → return flat file list for that job
  if (company || role) {
    const c = sanitizePart(company).split("_").slice(0, 3).join("_");
    const r = sanitizePart(role).split("_").slice(0, 3).join("_");
    const suffix = c && r ? `${c}_${r}` : c || r || "Tailored";
    const base = `Uday_Varmora_${suffix}_Resume`;

    const all = fs.readdirSync(resumesDir).filter((f) => f.endsWith(".pdf"));
    const files = all
      .filter((f) => f === `${base}.pdf` || f.startsWith(`${base}_v`))
      .map((name) => {
        const vm = name.match(/_v(\d+)\.pdf$/);
        return {
          name,
          version: vm ? parseInt(vm[1], 10) : 1,
          url: `/api/resumes/${encodeURIComponent(name)}`,
          mtime: fs.statSync(path.join(resumesDir, name)).mtime.toISOString(),
        };
      })
      .sort((a, b) => b.version - a.version);
    return NextResponse.json({ files });
  }

  // List-all mode
  const groups = parseResumesDir(resumesDir);
  const total = groups.reduce((s, g) => s + g.files.length, 0);
  return NextResponse.json({ groups, total });
}
