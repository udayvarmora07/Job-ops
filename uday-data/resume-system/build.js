#!/usr/bin/env node
// Build a tailored resume (docx + single-page PDF) from a content JSON file.
//
//   node uday-data/resume-system/build.js uday-data/resume-system/content/sarvam.json
//
// The format is fixed (matches the uploaded resumes); the content file supplies
// the per-JD wording. Spacing auto-tightens until the PDF fits one page.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Packer } = require('docx');
const { buildResumeDoc, SPACING_ORDER } = require('./resume-builder');

const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'output');

function pdfPageCount(pdfPath) {
  try {
    const out = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const m = out.match(/Pages:\s+(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null; // pdfinfo unavailable — skip the page check
  }
}

function toPdf(docxPath) {
  try {
    execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', OUT_DIR, docxPath], { stdio: 'ignore' });
    return docxPath.replace(/\.docx$/, '.pdf');
  } catch {
    return null; // LibreOffice unavailable — docx is still produced
  }
}

// Fail fast with an actionable message if the content JSON (e.g. one produced by
// the AI tailoring task) is missing keys or has the wrong shape — otherwise the
// docx builder throws an opaque stack trace deep inside the layout engine.
function validateContent(c, src) {
  const errs = [];
  const isStr = (v) => typeof v === 'string' && v.length > 0;
  if (!c || typeof c !== 'object') errs.push('root is not an object');
  for (const k of ['summary', 'title']) if (!isStr(c[k])) errs.push(`"${k}" must be a non-empty string`);

  if (!Array.isArray(c.skills) || !c.skills.length) errs.push('"skills" must be a non-empty array');
  else c.skills.forEach((row, i) => {
    if (!Array.isArray(row) || row.length !== 2 || !isStr(row[0]) || !isStr(row[1]))
      errs.push(`skills[${i}] must be ["Category", "items"]`);
  });

  if (!Array.isArray(c.experience) || !c.experience.length) errs.push('"experience" must be a non-empty array');
  else c.experience.forEach((j, i) => {
    if (!j || typeof j !== 'object') { errs.push(`experience[${i}] must be an object`); return; }
    for (const k of ['role', 'org', 'dates']) if (!isStr(j[k])) errs.push(`experience[${i}].${k} must be a non-empty string`);
    if (!Array.isArray(j.bullets) || !j.bullets.length) errs.push(`experience[${i}].bullets must be a non-empty array`);
  });

  if (!Array.isArray(c.projects) || !c.projects.length) errs.push('"projects" must be a non-empty array');
  else c.projects.forEach((p, i) => {
    if (!p || typeof p !== 'object') { errs.push(`projects[${i}] must be an object`); return; }
    for (const k of ['title', 'tech']) if (!isStr(p[k])) errs.push(`projects[${i}].${k} must be a non-empty string`);
    if (!Array.isArray(p.bullets) || !p.bullets.length) errs.push(`projects[${i}].bullets must be a non-empty array`);
  });

  if (!c.education || !isStr(c.education.left) || !isStr(c.education.right))
    errs.push('"education" must be { left, right } non-empty strings');

  if (errs.length) {
    console.error(`❌ Invalid resume content: ${path.basename(src)}`);
    for (const e of errs) console.error(`   - ${e}`);
    process.exit(2);
  }
}

async function main() {
  const contentArg = process.argv[2];
  if (!contentArg) {
    console.error('Usage: node build.js <content.json>');
    process.exit(1);
  }
  const contentPath = path.resolve(contentArg);
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  validateContent(content, contentPath);

  const suffix = content.filenameSuffix || path.basename(contentPath, '.json');
  const base = `Uday_Varmora_${suffix}_Resume`;
  const docxPath = path.join(OUT_DIR, base + '.docx');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Build with a given spacing arg, write docx + pdf, return the page count.
  async function render(spacingArg) {
    const doc = buildResumeDoc(content, spacingArg);
    fs.writeFileSync(docxPath, await Packer.toBuffer(doc));
    const pdf = toPdf(docxPath);
    return { pdf, pages: pdf ? pdfPageCount(pdf) : null };
  }

  let chosen, pages, pdfPath;

  if (content.spacing) {
    // Pinned preset (back-compat): honour it exactly.
    ({ pdf: pdfPath, pages } = await render(content.spacing));
    chosen = `${content.spacing} (pinned)`;
  } else {
    // 1) Baseline at the "normal" preset (fill factor 1.0).
    ({ pdf: pdfPath, pages } = await render(1.0));
    chosen = "fill ×1.00";

    if (pages === null) {
      // Can't measure (no LibreOffice/pdfinfo) → keep baseline.
    } else if (pages > 1) {
      // SHRINK: content is long — tighten via the dense/denser presets.
      for (const key of ["dense", "denser"]) {
        ({ pdf: pdfPath, pages } = await render(key));
        chosen = key;
        if (pages <= 1) break;
      }
    } else {
      // EXPAND (vertical fill): find the LARGEST factor that still fits one
      // page, so the resume spreads top-to-bottom with no big bottom gap.
      const HI_CAP = 1.6; // never look double-spaced, even for short content
      let lo = 1.0, hi = HI_CAP, best = 1.0;
      const cap = await render(HI_CAP);
      if (cap.pages !== null && cap.pages <= 1) {
        best = HI_CAP; // even the cap fits → use it
      } else {
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          const r = await render(mid);
          if (r.pages !== null && r.pages <= 1) { lo = mid; best = mid; }
          else { hi = mid; }
        }
      }
      // Rebuild the chosen best so the on-disk docx/pdf match it.
      ({ pdf: pdfPath, pages } = await render(best));
      chosen = `fill ×${best.toFixed(2)}`;
    }
  }

  console.log(`✅ ${base}`);
  console.log(`   docx:    ${path.relative(REPO_ROOT, docxPath)}`);
  if (pdfPath) console.log(`   pdf:     ${path.relative(REPO_ROOT, pdfPath)}`);
  console.log(`   spacing: ${chosen}`);
  if (pages !== null) {
    console.log(`   pages:   ${pages}${pages > 1 ? '  ⚠️ still over one page — trim a bullet in the content file' : ''}`);
  } else {
    console.log('   pages:   (not measured — pdfinfo/LibreOffice not available)');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
