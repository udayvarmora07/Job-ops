import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const prisma = new PrismaClient();

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

async function migrateApplications() {
  const filePath = path.join(ROOT, "data", "applications.md");
  const raw = readIfExists(filePath);
  if (!raw) return 0;

  let count = 0;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const cells = t.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 9) continue;
    if (!/^\d+$/.test(cells[0])) continue;

    const num = parseInt(cells[0], 10);
    const scoreMatch = cells[4].match(/([\d.]+)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    await prisma.application.upsert({
      where: { num },
      update: { score, status: cells[5].replace(/\*/g, "").trim() },
      create: {
        num,
        date: new Date(cells[1]),
        company: cells[2],
        role: cells[3],
        score,
        status: cells[5].replace(/\*/g, "").trim(),
        pdfUrl: cells[6].includes("✅") ? "generated" : null,
        reportUrl: cells[7] || null,
        notes: cells[8],
      },
    });
    count++;
  }
  return count;
}

async function migrateScanHistory() {
  const filePath = path.join(ROOT, "data", "scan-history.tsv");
  const raw = readIfExists(filePath);
  if (!raw) return 0;

  let count = 0;
  const lines = raw.split("\n").filter((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols[0] === "url") continue;
    const [url, firstSeen, portal, title, company, status, location] = cols;
    if (!url) continue;

    await prisma.scanHistory.upsert({
      where: { url },
      update: { status: status || "new" },
      create: {
        url,
        firstSeen: new Date(firstSeen || new Date()),
        portal: portal || "unknown",
        title: title || "",
        company: company || "Unknown",
        status: status || "new",
        location: location || null,
      },
    });
    count++;
  }
  return count;
}

async function migratePipeline() {
  const filePath = path.join(ROOT, "data", "pipeline.md");
  const raw = readIfExists(filePath);
  if (!raw) return 0;

  let count = 0;
  for (const line of raw.split("\n")) {
    const m = line.match(/^- \[( |x|X)\]\s*(\S+)\s*(?:\|\s*(.*))?$/);
    if (!m) continue;
    const url = m[2];
    const checked = m[1].toLowerCase() === "x";
    const rest = (m[3] || "").split("|").map((s) => s.trim());

    await prisma.pipelineItem.upsert({
      where: { url },
      update: { status: checked ? "done" : "pending" },
      create: {
        url,
        status: checked ? "done" : "pending",
        title: rest[1] || null,
        company: rest[0] || null,
      },
    });
    count++;
  }
  return count;
}

async function migrateReports() {
  const reportsDir = path.join(ROOT, "reports");
  let files;
  try {
    files = fs.readdirSync(reportsDir).filter((f) => f.endsWith(".md"));
  } catch {
    return 0;
  }

  let count = 0;
  for (const f of files) {
    const raw = readIfExists(path.join(reportsDir, f));
    if (!raw) continue;

    const idMatch = f.match(/^(\d+)/);
    if (!idMatch) continue;
    const num = parseInt(idMatch[1], 10);

    const titleLine = raw.split("\n").find((l) => l.startsWith("# ")) || "";
    const title = titleLine.replace(/^#\s*/, "").trim();
    const parts = title.split("\u2014").map((s) => s.trim());

    const scoreMatch = raw.match(/\*\*Score:\*\*\s*([\d.]+)/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    await prisma.report.upsert({
      where: { num },
      update: { content: raw, score },
      create: {
        num,
        company: parts[1] || parts[0] || title,
        role: parts[2] || "",
        score,
        content: raw,
      },
    });
    count++;
  }
  return count;
}

async function migrateOutreach() {
  const filePath = path.join(ROOT, "data", "outreach.json");
  const raw = readIfExists(filePath);
  if (!raw) return 0;

  let records;
  try {
    records = JSON.parse(raw);
  } catch {
    return 0;
  }
  if (!Array.isArray(records)) return 0;

  let count = 0;
  for (const r of records) {
    await prisma.outreach.create({
      data: {
        company: r.company || "Unknown",
        role: r.role || null,
        contact: r.contactName || null,
        email: r.email || null,
        subject: r.subject || null,
        status: r.status || "draft",
        notes: r.note || null,
      },
    });
    count++;
  }
  return count;
}

async function migrateReferrals() {
  const filePath = path.join(ROOT, "data", "referrals.json");
  const raw = readIfExists(filePath);
  if (!raw) return 0;

  let records;
  try {
    records = JSON.parse(raw);
  } catch {
    return 0;
  }
  if (!Array.isArray(records)) return 0;

  let count = 0;
  for (const r of records) {
    await prisma.referral.create({
      data: {
        company: r.company || "Unknown",
        role: r.role || null,
        contact: r.contact || null,
        channel: r.channel || null,
        status: r.status || "identified",
        notes: r.note || null,
      },
    });
    count++;
  }
  return count;
}

async function migrateResumes() {
  const resumesDir = path.join(ROOT, "output", "resumes");
  let files;
  try {
    files = fs.readdirSync(resumesDir).filter((f) => f.endsWith(".meta.json"));
  } catch {
    return 0;
  }

  let count = 0;
  for (const f of files) {
    const raw = readIfExists(path.join(resumesDir, f));
    if (!raw) continue;

    let meta;
    try {
      meta = JSON.parse(raw);
    } catch {
      continue;
    }

    const pdfFile = f.replace(".meta.json", ".pdf");
    const versionMatch = pdfFile.match(/_v(\d+)\.pdf$/);
    const version = versionMatch ? parseInt(versionMatch[1], 10) : 1;

    await prisma.resume.upsert({
      where: { filename: pdfFile },
      update: { metadata: meta },
      create: {
        company: meta.company || "Unknown",
        role: meta.role || "Unknown",
        filename: pdfFile,
        version,
        metadata: meta,
      },
    });
    count++;
  }
  return count;
}

async function main() {
  console.log("Starting migration from flat files to PostgreSQL...\n");

  const counts = {
    applications: await migrateApplications(),
    scanHistory: await migrateScanHistory(),
    pipeline: await migratePipeline(),
    reports: await migrateReports(),
    outreach: await migrateOutreach(),
    referrals: await migrateReferrals(),
    resumes: await migrateResumes(),
  };

  console.log("Migration complete:");
  for (const [key, count] of Object.entries(counts)) {
    console.log(`  ${key}: ${count} records migrated`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
