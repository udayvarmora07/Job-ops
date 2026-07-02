# Resume System — one fixed format, tailored per JD

Every resume comes out in the **same format** as your uploaded resumes
(Calibri, navy headers, centered name, Letter size, single page). Only the
**content** changes per job. The layout is locked in `resume-builder.js`; you
never touch it to tailor a resume.

## Files

| File | Role |
|------|------|
| `resume-builder.js` | The fixed format/layout engine + your fixed identity. Don't edit per-JD. |
| `build.js` | CLI: turns a content file into `.docx` + single-page `.pdf`. |
| `content/universal.json` | The default/master resume (baseline for every variant). |
| `content/<jd>.json` | One file per job — the tailored wording. |

Output `.docx` + `.pdf` land in `output/` at the repo root.

## Build a resume

```bash
node uday-data/resume-system/build.js uday-data/resume-system/content/sarvam.json
```

`build.js` auto-tightens line spacing (normal → dense → denser) until the PDF
is exactly one page, so denser tailored content never spills over.

## Tailor for a NEW job (the whole workflow)

1. Copy the baseline:
   `cp content/universal.json content/<company>.json`
2. Edit only the wording in `content/<company>.json` (follow
   `../02_JD_TAILORING_PROMPT.md` and stay inside `../01_MASTER_BRIEF.md`):
   - `filenameSuffix` → e.g. `"Acme_SRE"` (sets the output filename)
   - `summary` → reframe the opening toward the JD's focus
   - `skills` → reorder rows so the JD-relevant categories come first
   - `experience` / `projects` → reorder bullets; lead with what the JD wants
   - `colorScheme` → `"navy"` (default) or `"teal"` (startups)
3. Build it (command above).

Or just ask Claude: *"tailor my resume for this JD"* + paste the JD — Claude
writes the `content/<company>.json` and runs the build.

## Content file format

- Inline emphasis uses `**bold**` (same convention as `cv.md`).
- `skills` is a list of `["Category", "comma, separated, items"]` rows.
- Keep every skill row and project tech line to ONE rendered line (~115 chars).

## Honesty rules (from MASTER_BRIEF / JD_TAILORING_PROMPT)

- Only facts/metrics from `01_MASTER_BRIEF.md`. No fabrication.
- Experience stays **"1+ year"**. EKS upgrade is **v1.33 → v1.34**.
- Tier-3 = "Azure (Fundamentals)" framing only. NEVER-CLAIM items never appear
  (Go, GCP depth, OpenTelemetry, ML model serving, GPU-on-K8s, chaos eng.).
- British `-ise` spelling (Dockerised, containerised).

## Requirements

- `docx` npm package (installed at repo root).
- LibreOffice (`soffice`) for PDF, `pdfinfo`/`pdftoppm` (poppler) for the
  page-fit check. The `.docx` builds even without them; only the PDF step needs
  LibreOffice. Calibri rendering uses the metric-compatible **Carlito** font.
```
