# Jobops — AI Job Search Pipeline

## Critical Rules

- **Data layers:** User (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`, `data/*`, `reports/*`, `output/*`, `interview-prep/*`) → NEVER auto-updated. System (`modes/_shared.md`, `AGENTS.md`, `*.mjs`, `templates/*`, `batch/*`) → auto-updatable.
- **Personalization:** Store in `modes/_profile.md` or `config/profile.yml`. NEVER edit `modes/_shared.md` for user content.
- **Onboarding:** First message → `node doctor.mjs --json`. If `onboardingNeeded`, guide through CV → Profile → Portals → Tracker.
- **Update check:** First message → `node update-system.mjs check`. Notify user only if `update-available`.
- **Offer verification:** ALWAYS use Playwright (`browser_navigate` + `browser_snapshot`). Never trust WebSearch/WebFetch.
- **Ethical:** NEVER submit applications. Score < 4.0/5 → recommend against. Quality over quantity.
- **Tracking:** NEVER add entries to `data/applications.md` directly. Write TSV to `batch/tracker-additions/`. Run `node merge-tracker.mjs` after batches.
- **Reports:** Must include `**URL:**`, `**Score:** X.X/5`, `**Legitimacy:** {tier}` in header.
- **Canonical states:** `Evaluated`, `Applied`, `Responded`, `Interview`, `Offer`, `Rejected`, `Discarded`, `SKIP`. No bold, no dates in status field. Source: `templates/states.yml`.
- **CV source of truth:** `cv.md`. NEVER hardcode metrics.

## Compact File Reference

| File | Function |
|------|----------|
| `modes/_shared.md` | Core evaluation criteria & scoring |
| `modes/oferta.md` | A-F evaluation blocks for offers |
| `modes/auto-pipeline.md` | Full pipeline: evaluate + report + PDF + tracker |
| `modes/scan.md` | Portal scanning instructions |
| `modes/interview-prep.md` | Interview prep generation |
| `modes/deep.md` | Company deep research |
| `modes/contacto.md` | LinkedIn outreach |
| `modes/tracker.md` | Application status |
| `modes/pipeline.md` | Pipeline inbox processing |
| `modes/followup.md` | Follow-up cadence |
| `modes/patterns.md` | Rejection pattern analysis |
| `modes/apply.md` | Application form assistant |
| `modes/pdf.md` | CV PDF generation |
| `modes/cover.md` | Cover letter |
| `modes/training.md` | Course/cert evaluation |
| `modes/project.md` | Portfolio project evaluation |
| `modes/ofertas.md` | Compare multiple offers |
| `modes/latex.md` | LaTeX export |
| `modes/ats.md` | ATS score + resume review |
| `modes/batch.md` | Batch processing |
| `modes/update.md` | System update |
| `modes/_profile.md` | User-specific archetypes & narrative |
| `batch/batch-prompt.md` | Batch processing prompt (large) |
| `templates/states.yml` | Canonical application states |
| `templates/cv-template.html` / `.tex` | CV templates |
| `data/applications.md` | Application tracker |
| `data/pipeline.md` | Pending URLs inbox |
| `portals.yml` | Portal scan config |

## TSV Format for Tracker Additions

`{num}\t{date}\t{company}\t{role}\t{status}\t{score}/5\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}`

Column order: num, date, company, role, status, score, pdf, report link (root-relative), notes.

## Context Optimization

- **Lazy-load mode files** — only read the mode file for the current task. Don't preload all modes.
- **Use subagents for heavy work** — delegate evaluation/scan/research to `@jobops-evaluate`, `@jobops-scan`, etc.
- **Don't load entire AGENTS.md again** — the rules above are the essential subset.
