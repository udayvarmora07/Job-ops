# Jobops — AI Briefing Document

> **Purpose:** Read this file at the start of any session to get complete project knowledge without exploring the codebase. Everything an AI needs to understand, modify, or extend this project is here.

---

## 1. What This Project Is

**Jobops** is a full-stack AI job-search automation system built for **Uday Varmora** (DevOps engineer, Ahmedabad, India, 1+ year experience). It has two layers:

- **CLI layer** (`modes/`, `*.mjs` scripts) — AI-powered job evaluation, CV generation, portal scanning. Driven via Claude Code / Gemini CLI slash commands. Originally built by santifer; customized for Uday.
- **Web dashboard** (`web/`) — A custom Next.js 14 app at port **4317** that provides a GUI for everything: browsing 350+ scanned jobs, generating/managing tailored PDFs, tracking applications, referral outreach, AI Studio.

The web dashboard is **100% Uday's custom build** — it is NOT part of the upstream jobops open-source repo and will never be overwritten by `node update-system.mjs`.

---

## 2. Stack & Key Tooling

| Layer | Tech |
|-------|------|
| Web app | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI, Framer Motion |
| PDF generation | LibreOffice (converts DOCX→PDF via resume-builder.js) |
| Resume builder | `uday-data/resume-system/build.js` — binary-search spacing, single-page auto-fit |
| AI tasks | `lib-ai/` — OpenAI-compatible multi-provider (DeepSeek primary, NVIDIA NIM fallback) |
| Data storage | Plain files: `.md`, `.tsv`, `.json`, `.yaml` — no database |
| Job scanning | `scan.mjs` — zero-LLM-cost, hits Greenhouse/Ashby/Lever APIs directly |
| Runtime | Node.js (ESM `.mjs` modules) |

---

## 3. Directory Map

```
jobops/
├── web/                     ← Next.js dashboard (PORT 4317)
│   ├── app/
│   │   ├── api/             ← All API routes (see §6)
│   │   └── page.tsx         ← Single page, renders Dashboard
│   ├── components/dashboard/← All UI components (see §5)
│   ├── lib/                 ← Shared server + client utils
│   └── CLAUDE.md            ← Web-specific AI instructions (auto-loaded)
│
├── lib-ai/                  ← AI engine (provider routing, task builders)
│   ├── config.mjs           ← Reads config/ai.yml, resolves model chains
│   ├── run.mjs              ← Non-streaming task runner (returns {text})
│   ├── stream.mjs           ← Streaming task runner (returns ReadableStream)
│   ├── registry.mjs         ← Maps task names → builder functions
│   └── tasks/               ← One file per AI task
│
├── uday-data/               ← USER data (never touched by system updates)
│   ├── 01_MASTER_BRIEF.md   ← THE source of truth for resume facts (read before any CV task)
│   ├── resume-system/       ← DOCX resume builder
│   │   ├── build.js         ← Binary-search spacing engine, outputs PDF+DOCX
│   │   ├── resume-builder.js← Layout primitives, font defs, margin rules
│   │   └── content/         ← JSON content files (_studio_draft.json = AI scratch)
│   └── REFERENCE.md         ← Resume system usage guide
│
├── data/                    ← Live job-search data (USER layer)
│   ├── applications.md      ← Application tracker (markdown table, 9 cols)
│   ├── pipeline.md          ← Inbox of URLs to evaluate (checkbox list)
│   ├── scan-history.tsv     ← 341 scanned jobs (7 cols, no header col 7+)
│   ├── referrals.json       ← Referral tracking (array of Referral objects)
│   └── follow-ups.md        ← Follow-up cadence log
│
├── output/                  ← Generated PDFs/HTML (gitignored)
│   └── resumes/             ← VERSIONED resume store (web dashboard writes here)
│       ├── Uday_Varmora_SUFFIX_Resume.pdf       ← v1
│       ├── Uday_Varmora_SUFFIX_Resume_v2.pdf    ← v2
│       └── Uday_Varmora_SUFFIX_Resume.meta.json ← sidecar: {company, role, createdAt}
│
├── reports/                 ← Evaluation reports (###-company-YYYY-MM-DD.md)
├── config/
│   ├── profile.yml          ← Uday's targeting profile (drives referral scoring)
│   └── ai.yml               ← Model routing table (USER layer)
├── modes/                   ← CLI mode prompts (_profile.md = user customizations)
├── templates/               ← CV templates, states.yml, portals.example.yml
└── portals.yml              ← Active portal/company scan config
```

---

## 4. Data Layer — Formats & Rules

### `data/scan-history.tsv`
7 tab-separated columns (no header for col 7+):
```
url  first_seen  portal  title  company  status  location
```
- 341 rows as of June 2026
- `status` is usually "added"
- Col 8 (index 7) reserved for exp text from JD (usually empty)
- Parsed by `web/lib/parsers.ts → parseScanHistory()`

### `data/applications.md`
Markdown table, 9 columns (order matters):
```
# | Date | Company | Role | Score | Status | PDF | Report | Notes
```
- NEVER add rows directly — write TSV to `batch/tracker-additions/` and run `node merge-tracker.mjs`
- YES to editing existing rows (status updates, notes)
- Statuses must match `templates/states.yml` (Evaluated/Applied/Responded/Interview/Offer/Rejected/Discarded/SKIP)

### `data/referrals.json`
Array of `Referral` objects:
```typescript
{ id, company, role, contact, channel, status, jobUrl, note, askedDate, updatedAt }
```
Status values: `to_ask | asked | responded | referred | declined`

### `output/resumes/`
- Naming: `Uday_Varmora_{SUFFIX}_Resume.pdf` (v1), `..._v2.pdf` etc.
- Suffix built by `buildFilenameSuffix(company, role)` — company (3 words max) + role (3 words max), underscored
- Each PDF has a `.meta.json` sidecar with `{ company, role, createdAt }`
- Listed by `GET /api/resumes`, served by `GET /api/resumes/[filename]`
- Old resumes from prior sessions are in `output/` (flat), migrated to `output/resumes/` on 2026-06-23

### `config/ai.yml`
Controls which AI model runs each task. Primary: `deepseek:deepseek-v4-pro`. Fallback: NVIDIA NIM.

---

## 5. Web Dashboard — Components

The app is a single-page dashboard with 8 tabs. All tabs are rendered on the client; data is fetched from Next.js API routes.

### Tab Overview

| Tab | Component | Data source | Key features |
|-----|-----------|-------------|--------------|
| Overview | `Overview.tsx` | `/api/summary` | Funnel chart, conversion rates, status breakdown |
| Jobs | `JobsBrowser.tsx` | `/api/jobs` | 350 jobs, search/filter, Exp column, job detail dialog |
| Applications | `Applications.tsx` | `/api/applications` | Tracker from applications.md, inline status edit |
| Referrals | `Referrals.tsx` | `/api/referrals` | Referral status tracking, AI-suggested contacts |
| Reports | `ReportsView.tsx` | `/api/reports` | Evaluation report list, inline preview |
| Resumes | `ResumesLibrary.tsx` | `/api/resumes` | 33+ PDFs, versioned, preview/download/delete/update |
| Pipeline | `PipelineManager.tsx` | `/api/pipeline` | Pending URL inbox, add/delete URLs |
| AI Studio | `AiStudio.tsx` | `/api/ai/[task]` | Streaming AI for full JD evaluations |

### `JobDetailDialog.tsx` (most complex component)
Opens when a job row is clicked. Sections:
- **Status** — matched application from tracker; "Evaluate & Save" button
- **Résumé** — version pills (saved resumes for this job), "Generate & preview résumé" / "Update résumé (save as vN)" button, PDF iframe preview, Download/Open buttons
- **Cover Letter** — streaming AI, downloadable PDF
- **Interview Prep** — streaming AI
- **Best Referral Paths** — AI-generated personas + LinkedIn search links + outreach DM drafts

### `ResumesLibrary.tsx`
- Groups all PDFs in `output/resumes/` by base suffix
- Shows version pills per group (newest first, highlighted as "latest")
- **Preview modal** — full-screen iframe
- **Update modal** — two textareas: JD (optional) + instructions (optional) → calls `/api/generate-cv-pdf` → saves new version
- **Delete** — calls `DELETE /api/resumes/[filename]`, removes PDF + `.meta.json`

### Key Lib Files

| File | Purpose |
|------|---------|
| `web/lib/types.ts` | All shared TypeScript interfaces (Job, Application, Referral, ReportMeta, etc.) |
| `web/lib/parsers.ts` | Reads raw data files → typed objects (parseJobs, parseApplications, listReports) |
| `web/lib/paths.ts` | `projectRoot()` → resolves jobops root; `FILES.*` → canonical file paths |
| `web/lib/experience.ts` | `extractExp(title, jdSnippet)` → ExpInfo; `expBucket()` → entry/mid/senior/unknown |
| `web/lib/suggest.ts` | Referral contact scoring engine (persona, warmth, draft messages) |
| `web/lib/profile.ts` | Reads `config/profile.yml` → CandidateProfile (used by suggest.ts) |
| `web/lib/run-node.ts` | `runNode(args, opts)` → spawns Node.js child process (used to call build.js) |
| `web/lib/cache.ts` | Simple file-based cache for AI referral targets |

---

## 6. API Routes Reference

All routes: `web/app/api/`

### Core Data

| Route | Method | In | Out | Notes |
|-------|--------|----|-----|-------|
| `/api/summary` | GET | — | `Summary` object | Funnel counts, rates, avg score |
| `/api/jobs` | GET | — | `{ jobs: Job[] }` | Merges scan-history.tsv + pipeline.md |
| `/api/jobs` | DELETE | `{ url }` | `{ ok }` | Removes from scan-history.tsv |
| `/api/applications` | GET | — | `{ applications }` | Parses applications.md |
| `/api/applications` | PATCH | `{ num, field, value }` | `{ ok }` | Updates single cell in applications.md |
| `/api/reports` | GET | — | `{ reports: ReportMeta[] }` | Lists reports/*.md, parses headers |
| `/api/pipeline` | GET | — | `{ items }` | Reads data/pipeline.md |
| `/api/pipeline` | POST | `{ url }` | `{ ok, duplicate }` | Appends to pipeline.md |
| `/api/pipeline` | DELETE | `{ url }` | `{ ok }` | Removes from pipeline.md |
| `/api/referrals` | GET | — | `{ referrals }` | Reads data/referrals.json |
| `/api/referrals` | POST | Referral fields | `{ id }` | Appends to referrals.json |
| `/api/referrals` | DELETE | `{ id }` | `{ ok }` | Removes from referrals.json |
| `/api/scan` | POST | — | `{ summary, newCount }` | Runs scan.mjs, returns new job count |

### Resumes

| Route | Method | In | Out | Notes |
|-------|--------|----|-----|-------|
| `/api/resumes` | GET (no params) | — | `{ groups, total }` | All PDFs grouped by suffix |
| `/api/resumes` | GET `?company=&role=` | — | `{ files }` | Filtered flat list for one job |
| `/api/resumes/[filename]` | GET | — | PDF bytes | Serves file from output/resumes/ |
| `/api/resumes/[filename]` | DELETE | — | `{ ok }` | Deletes PDF + .meta.json sidecar |
| `/api/generate-cv-pdf` | POST | `{ jd, company?, role?, instructions? }` | PDF bytes | Full AI tailoring pipeline (30–60s); saves versioned copy to output/resumes/; returns `X-Saved-Filename`, `X-Saved-Version` headers |
| `/api/generate-cover-pdf` | POST | `{ text }` | PDF bytes | Converts markdown cover letter to PDF |

### AI

| Route | Method | In | Out | Notes |
|-------|--------|----|-----|-------|
| `/api/ai/[task]` | POST | `{ input, model? }` | Streaming text | Tasks: `tailor_cv`, `cover_letter`, `evaluate_job`, `interview_prep`, `draft_referral`, `connection_notes` |
| `/api/evaluate-save` | POST | `{ jd }` | `{ num, score, company, role }` | Evaluates + writes report + TSV entry, runs merge-tracker |
| `/api/referrals/ai-targets` | GET | `?company=&role=` | `{ cached, targets, strategy }` | Returns cached if available |
| `/api/referrals/ai-targets` | POST | `{ company, role, refresh? }` | `{ targets, strategy }` | AI-generated referral personas |
| `/api/referrals/suggest` | GET | `?company=&role=` | `SuggestResult` | Rule-based scoring (no AI cost) |
| `/api/referrals/find-people` | POST | `{ company, role, keywords, persona }` | `{ people }` | Apify LinkedIn scraper |
| `/api/referrals/connection-notes` | GET/POST | — | `{ notes }` | Persistent connection notes per company+role+persona |

---

## 7. Resume Generation Pipeline (Full Flow)

```
User clicks "Generate & preview résumé" in JobDetailDialog
    ↓
POST /api/generate-cv-pdf { jd, company, role, instructions? }
    ↓
lib-ai/tasks/tailor-cv-json.mjs → buildTailorCvJson(jd, instructions)
    System prompt: MASTER BRIEF + universal.json template + article-digest.md
    User prompt:   JD text + optional SPECIFIC UPDATE INSTRUCTIONS block
    ↓
AI returns JSON (DeepSeek V4 Pro primary, NIM fallback)
    JSON shape: { filenameSuffix, title, colorScheme, summary, skills,
                  experience, projects, education, achievements }
    ↓
build.js validates JSON (exits code 2 if invalid)
    ↓
uday-data/resume-system/build.js
    Binary-search spacing → fills exactly one Letter-size page
    LibreOffice converts DOCX → PDF
    Output: output/Uday_Varmora_{SUFFIX}_Resume.pdf
    ↓
API copies PDF → output/resumes/Uday_Varmora_{SUFFIX}_Resume[_vN].pdf
    Saves .meta.json sidecar: { company, role, createdAt }
    Returns PDF bytes + X-Saved-Version header
    ↓
Client creates blob URL → shows in <iframe> (WYSIWYG preview)
    Version pill appears in saved list; button changes to "Update résumé (save as vN+1)"
```

**Key constraints:**
- `filenameSuffix` in AI JSON is ALWAYS `"Studio_Tailored"` (build.js uses it internally; the real name is set by the API)
- LibreOffice must be installed (`libreoffice --headless`)
- Instructions are injected as `SPECIFIC UPDATE INSTRUCTIONS` block in the AI prompt
- Old resumes (prefix `01_`, `02_`, etc.) were migrated to `output/resumes/` on 2026-06-23

---

## 8. AI Integration (`lib-ai/`)

### Model Routing (`config/ai.yml`)
```yaml
default: deepseek:deepseek-v4-pro
tasks:
  tailor_cv_json:    [deepseek:deepseek-v4-pro, nim:deepseek-ai/deepseek-r1]
  evaluate_job:      [deepseek:deepseek-v4-pro, nim:deepseek-ai/deepseek-r1]
  tailor_cv:         [deepseek:deepseek-v4-pro]
  cover_letter:      [deepseek:deepseek-v4-pro]
  interview_prep:    [deepseek:deepseek-v4-pro]
  referral_targets:  [deepseek:deepseek-v4-pro]
  draft_referral:    [deepseek:deepseek-v4-pro]
  connection_notes:  [deepseek:deepseek-v4-pro]
```

### Task Builders (`lib-ai/tasks/`)
Each task exports a `build*()` function that assembles `{ system, prompt }` from user files.

| Task file | Builder | What it does |
|-----------|---------|-------------|
| `tailor-cv-json.mjs` | `buildTailorCvJson(jd, instructions?)` | Outputs JSON for resume-system/build.js |
| `tailor-cv.mjs` | `buildTailorCv(input)` | Streams markdown tailoring analysis |
| `evaluate-job.mjs` | `buildEvaluateJob(input)` | Full 6-block evaluation report |
| `cover-letter.mjs` | `buildCoverLetter(input)` | Personalised cover letter |
| `interview-prep.mjs` | `buildInterviewPrep(input)` | Company-specific prep guide |
| `referral-targets.mjs` | `buildReferralTargets(input)` | 3 best referral personas + outreach DMs |
| `draft-referral.mjs` | `buildDraftReferral(input)` | Single targeted outreach message |
| `connection-notes.mjs` | `buildConnectionNotes(input)` | Notes on a specific connection |

### `lib-ai/context.mjs`
Provides `read(relativePath, label?)` — reads files relative to project root. Used in task builders to inject `cv.md`, `01_MASTER_BRIEF.md`, `modes/_shared.md`, `modes/_profile.md`, etc. into prompts.

---

## 9. Experience Column (`web/lib/experience.ts`)

Added to Jobs tab to show required experience without reading JDs (title-only parsing).

Parser priority (highest wins):
1. Explicit range: `"4-8 yrs"`, `"1 to 4 Years"` → `4-8 yr`
2. N+ years: `"8+ Years"` → `8+ yr`
3. Bare N years near context words (`experience`, `minimum`) → `N+ yr`
4. Level numbers: `SDE-2` → `2-4 yr`, `L5` → `6-8 yr`, `Engineer III` → `4-6 yr`
5. Seniority keywords: `Senior` → `3+ yr`, `Lead/Architect` → `5+ yr`, `Staff` → `6+ yr`, `Principal` → `8+ yr`, `Associate` → `0-3 yr`, `Junior` → `0-2 yr`

Colour coding in UI: green = entry (<3 yr, fits Uday's 1+ yr profile), amber = mid (3–6 yr, stretch), gray = senior (6+ yr, over-range), muted dash = unknown.

---

## 10. User Profile — Uday Varmora

> **Source of truth:** `uday-data/01_MASTER_BRIEF.md` (read it before any resume/AI task)

**Identity:** DevOps Engineer, Ahmedabad, India, 1+ year total experience
- Current: eSparkBiz Technologies (intern Jan–May 2025, full-time Jun 2025–Apr 2026, promoted within 5 months)
- Education: B.Tech IT, Dharmsinh Desai University (CGPA 7.25)
- Email: varmorauday1045@gmail.com

**Target roles:** DevOps Engineer, SRE, Cloud Engineer, Platform Engineer (India market, 0–4 yr exp range)

**Key anchor metrics (NEVER invent others):**
99.9% uptime SLA · 82% faster releases · 80% faster provisioning · 30% compute cost reduction · 40+ CI/CD pipelines · 34 Terraform modules · 20+ Dockerised microservices · EKS v1.33→v1.34 upgrade

**NEVER CLAIM:** error budgets, Go, GCP, chaos engineering, OpenTelemetry/Jaeger

**Tier-1 stack:** AWS (EKS/EC2/Lambda/S3/RDS/IAM/KMS/CloudWatch), Docker, Kubernetes, Helm, ArgoCD, Karpenter, KEDA, Terraform, Jenkins, GitLab CI, GitHub Actions, Prometheus, Grafana, Loki, Python, Bash, HashiCorp Vault, Trivy

---

## 11. Common Tasks — Quick Guide

### Start the web dashboard
```bash
cd web && npm run dev   # port 4317
# OR use the preview tool with config: .claude/launch.json name="career-web"
```

### Add a new API route
1. Create `web/app/api/my-route/route.ts`
2. Export `runtime = "nodejs"`, `dynamic = "force-dynamic"` at top
3. Export `GET`, `POST`, etc. handler functions
4. Import from `@/lib/paths` for file access

### Add a new AI task
1. Create `lib-ai/tasks/my-task.mjs` with `export function buildMyTask(input) { return { system, prompt }; }`
2. Register in `lib-ai/tasks/index.mjs` and `lib-ai/registry.mjs`
3. Add model routing in `config/ai.yml`
4. Call via `POST /api/ai/my_task` or `runTask('my_task', ...)` from a route

### Generate a tailored resume PDF (programmatic)
```typescript
const res = await fetch('/api/generate-cv-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jd: 'Role: DevOps Engineer\nCompany: Acme Corp\n[full JD...]',
    company: 'Acme Corp',
    role: 'DevOps Engineer',
    instructions: 'Emphasize Kubernetes. Lead with SRE framing.',  // optional
  }),
});
// Response: PDF bytes
// Headers: X-Saved-Filename, X-Saved-Version
```

### Check if a resume exists for a job
```typescript
const res = await fetch('/api/resumes?company=Acme+Corp&role=DevOps+Engineer');
const { files } = await res.json();  // [ { name, version, url, mtime }, ... ]
```

### Update job experience in the tracker
Edit `data/applications.md` directly (only for updating existing rows). To ADD new rows, write a TSV to `batch/tracker-additions/` and run `node merge-tracker.mjs`.

---

## 12. Known Gotchas & Rules

- **LibreOffice required** for PDF generation. If missing, `build.js` silently fails and the PDF file won't exist. Error caught by the API route.
- **`output/resumes/` is the canonical resume store** for web-UI-generated PDFs. Old manually-generated resumes in `output/` (prefixed `01_`, `02_`, etc.) were migrated there on 2026-06-23.
- **Sidecar `.meta.json`** is created alongside every PDF saved by the web UI. Without it, the Update modal falls back to parsing company/role from the filename suffix (lossy).
- **`applications.md` column order**: `Score` comes BEFORE `Status` in the tracker table. The TSV format for additions has `Status` BEFORE `Score`; `merge-tracker.mjs` handles the swap.
- **Report numbering**: sequential 3-digit zero-padded. Check max existing before creating a new report.
- **Scan history** has no column 7 header — the location column (index 6) is the last named column. Extra columns are allowed.
- **`projectRoot()`** in the web app resolves to the jobops root (one level up from `web/`). Always use this — never hardcode paths.
- **`X-Saved-Version` header** on `/api/generate-cv-pdf` response — read BEFORE consuming the response body as a blob (headers are unavailable after `res.blob()`).
- **Radix UI tabs** don't respond to programmatic `click()` in the preview tool — use `elementFromPoint` at the exact pixel coordinate of the tab button instead.
- **PDF iframe screenshots** always time out in the preview tool — use DOM eval to verify iframe attributes instead of screenshots.
- **Port 4317** is the web dashboard. The preview tool launch config is in `.claude/launch.json` (name: `career-web`).
