import fs from "fs";
import path from "path";
import { FILES, reportsDir } from "./paths";
import { extractExp } from "./experience";

function readIfExists(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Applications (data/applications.md — markdown table)               */
/* ------------------------------------------------------------------ */

export interface Application {
  num: string;
  date: string;
  company: string;
  role: string;
  score: string;
  scoreNum: number | null;
  status: string;
  pdf: boolean;
  reportNum: string | null;
  notes: string;
}

function stripLink(cell: string): { text: string; href: string | null } {
  const m = cell.match(/\[([^\]]*)\]\(([^)]*)\)/);
  if (m) return { text: m[1], href: m[2] };
  return { text: cell, href: null };
}

export function parseApplications(): Application[] {
  const raw = readIfExists(FILES.applications());
  if (!raw) return [];
  const rows: Application[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const cells = t.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 9) continue;
    if (/^#$/i.test(cells[0]) || /^-+$/.test(cells[0])) continue; // header / separator
    if (!/^\d+$/.test(cells[0])) continue;
    const report = stripLink(cells[7]);
    const scoreMatch = cells[4].match(/([\d.]+)/);
    rows.push({
      num: cells[0],
      date: cells[1],
      company: cells[2],
      role: cells[3],
      score: cells[4],
      scoreNum: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: cells[5].replace(/\*/g, "").trim(),
      pdf: cells[6].includes("✅"),
      reportNum: report.text || null,
      notes: cells[8],
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Fetched jobs (scan-history.tsv + pipeline.md)                       */
/* ------------------------------------------------------------------ */

export interface Job {
  url: string;
  company: string;
  role: string;
  portal: string | null;
  location: string | null;
  firstSeen: string | null;
  inPipeline: boolean;
  processed: boolean;
  source: "scan" | "pipeline" | "both";
  expRequired: string | null;
  expMinYears: number | null;
}

function parseScanHistory(): Map<string, Job> {
  const raw = readIfExists(FILES.scanHistory());
  const map = new Map<string, Job>();
  if (!raw) return map;
  const lines = raw.split("\n").filter((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols[0] === "url") continue; // header
    // col 7 (index 7) = optional exp_required stored by the scanner
    const [url, firstSeen, portal, title, company, , location, expCol] = cols;
    if (!url) continue;
    const exp = extractExp(title || "", expCol || "");
    map.set(url, {
      url,
      company: company || "Unknown",
      role: title || "",
      portal: portal || null,
      location: location || null,
      firstSeen: firstSeen || null,
      inPipeline: false,
      processed: false,
      source: "scan",
      expRequired: exp?.display ?? null,
      expMinYears: exp?.minYears ?? null,
    });
  }
  return map;
}

function parsePipeline(map: Map<string, Job>) {
  const raw = readIfExists(FILES.pipeline());
  if (!raw) return;
  let processedSection = false;
  for (const line of raw.split("\n")) {
    if (/^##\s+Procesadas/i.test(line)) processedSection = true;
    else if (/^##\s/.test(line)) processedSection = false;
    const m = line.match(/^- \[( |x|X)\]\s*(\S+)\s*(?:\|\s*(.*))?$/);
    if (!m) continue;
    const checked = m[1].toLowerCase() === "x";
    const url = m[2];
    const rest = (m[3] || "").split("|").map((s) => s.trim());
    const company = rest[0] || "";
    const role = rest.slice(1).join(" | ") || "";
    const existing = map.get(url);
    if (existing) {
      existing.inPipeline = true;
      existing.processed = checked || processedSection;
      existing.source = "both";
      if (!existing.role && role) existing.role = role;
      if ((existing.company === "Unknown" || !existing.company) && company)
        existing.company = company;
    } else {
      const pexp = extractExp(role || "");
      map.set(url, {
        url,
        company: company || "Unknown",
        role,
        portal: null,
        location: null,
        firstSeen: null,
        inPipeline: true,
        processed: checked || processedSection,
        source: "pipeline",
        expRequired: pexp?.display ?? null,
        expMinYears: pexp?.minYears ?? null,
      });
    }
  }
}

export function parseJobs(): Job[] {
  const map = parseScanHistory();
  parsePipeline(map);
  return Array.from(map.values()).sort((a, b) => {
    const da = a.firstSeen || "";
    const db = b.firstSeen || "";
    if (da !== db) return db.localeCompare(da);
    return a.company.localeCompare(b.company);
  });
}

/* ------------------------------------------------------------------ */
/* Reports (reports/*.md)                                              */
/* ------------------------------------------------------------------ */

export interface ReportMeta {
  id: string;
  file: string;
  title: string;
  company: string;
  role: string;
  date: string | null;
  score: string | null;
  scoreNum: number | null;
  url: string | null;
  legitimacy: string | null;
  archetype: string | null;
  location: string | null;
}

function field(raw: string, name: string): string | null {
  const re = new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`, "i");
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

export function listReports(): ReportMeta[] {
  let files: string[];
  try {
    files = fs.readdirSync(reportsDir()).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const reports: ReportMeta[] = [];
  for (const f of files) {
    const raw = readIfExists(path.join(reportsDir(), f));
    if (!raw) continue;
    const titleLine = raw.split("\n").find((l) => l.startsWith("# ")) || "";
    const title = titleLine.replace(/^#\s*/, "").trim();
    const parts = title.split("—").map((s) => s.trim()); // em-dash
    const idMatch = f.match(/^(\d+)/);
    const score = field(raw, "Score");
    const scoreNum = score ? parseFloat((score.match(/([\d.]+)/) || [])[1]) : null;
    reports.push({
      id: idMatch ? idMatch[1] : f,
      file: f,
      title,
      company: parts[1] || parts[0] || title,
      role: parts[2] || "",
      date: field(raw, "Date"),
      score,
      scoreNum: Number.isFinite(scoreNum as number) ? (scoreNum as number) : null,
      url: field(raw, "URL"),
      legitimacy: field(raw, "Legitimacy"),
      archetype: field(raw, "Archetype"),
      location: field(raw, "Location"),
    });
  }
  return reports.sort((a, b) => a.id.localeCompare(b.id));
}

export function readReport(id: string): { meta: ReportMeta; body: string } | null {
  const reports = listReports();
  const meta = reports.find((r) => r.id === id || r.file === id);
  if (!meta) return null;
  const raw = readIfExists(path.join(reportsDir(), meta.file));
  if (!raw) return null;
  return { meta, body: raw };
}
