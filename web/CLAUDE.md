# Web Dashboard — Claude Code Instructions

**Read `docs/AI_BRIEFING.md` in the project root for full context.**  
This file covers web-specific rules and conventions only.

---

## Quick Facts

- **Port:** 4317 (`npm run dev` from `web/`)
- **Framework:** Next.js 14 App Router, TypeScript strict mode
- **Project root:** one level up — `path.join(__dirname, '..')` or use `projectRoot()` from `@/lib/paths`
- **Preview launch config:** `.claude/launch.json` → name `"career-web"`

---

## Key Files & Their Roles

| File | What it does |
|------|--------------|
| `web/lib/paths.ts` | `projectRoot()` resolves career-ops root. `FILES.*` — canonical paths for data files |
| `web/lib/types.ts` | All shared TS interfaces. **Always update this first** when adding new fields |
| `web/lib/parsers.ts` | Reads raw `.tsv`/`.md` files → typed arrays. `parseJobs()` merges scan-history + pipeline |
| `web/lib/experience.ts` | `extractExp(title, jdSnippet?)` → `{ label, minYears }`. Multi-level parser |
| `web/lib/suggest.ts` | Referral contact scoring — no AI cost, rule-based |
| `web/lib/profile.ts` | Reads `config/profile.yml` → `CandidateProfile` |
| `web/lib/run-node.ts` | `runNode(args, opts)` — spawns Node child process from project root |
| `web/lib/cache.ts` | File-based cache for AI responses (referral targets) |
| `web/components/dashboard/Dashboard.tsx` | Root dashboard — tab list, command palette, all `<TabsContent>` |
| `web/components/dashboard/JobDetailDialog.tsx` | Job detail, resume generation, referral AI — most complex component |
| `web/components/dashboard/ResumesLibrary.tsx` | Resume library tab — version management, preview/download/delete/update |

---

## API Routes Map

```
web/app/api/
├── summary/route.ts          GET → { funnel, conversionRates, avgScore }
├── jobs/route.ts             GET → { jobs }, DELETE { url }
├── applications/route.ts     GET → { applications }, PATCH { num, field, value }
├── reports/route.ts          GET → { reports: ReportMeta[] }
├── pipeline/route.ts         GET → { items }, POST { url }, DELETE { url }
├── referrals/route.ts        GET/POST/DELETE referrals.json
├── scan/route.ts             POST → runs scan.mjs
├── resumes/route.ts          GET list-all or ?company=&role= filter
├── resumes/[filename]/route.ts  GET serve PDF, DELETE remove + sidecar
├── generate-cv-pdf/route.ts  POST { jd, company?, role?, instructions? } → PDF bytes
├── generate-cover-pdf/route.ts POST { text } → PDF bytes
└── ai/
    ├── [task]/route.ts       POST { input } → streaming text (or JSON for non-streaming)
    ├── evaluate-save/route.ts POST { jd } → writes report + tracker TSV + merges
    └── referrals/
        ├── ai-targets/route.ts   GET/POST referral personas with caching
        ├── suggest/route.ts      GET rule-based scoring
        ├── find-people/route.ts  POST Apify LinkedIn scraper
        └── connection-notes/route.ts GET/POST persistent connection notes
```

---

## Resume Generation Flow

```
POST /api/generate-cv-pdf { jd, company, role, instructions? }
  ↓
buildTailorCvJson(jd, instructions) → { system, prompt }
  ↓ (via lib-ai/run.mjs, model: deepseek-v4-pro)
AI returns JSON { filenameSuffix, title, colorScheme, summary, skills, experience, projects, education, achievements }
  ↓
API overrides filenameSuffix = buildFilenameSuffix(company, role)  ← ALWAYS overridden
  ↓
uday-data/resume-system/build.js [content-path]
  → LibreOffice DOCX → PDF → output/Uday_Varmora_{SUFFIX}_Resume.pdf
  ↓
nextVersionedFilename(suffix, output/resumes/) → v1 / v2 / v3...
  → copies PDF to output/resumes/
  → writes .meta.json sidecar { company, role, createdAt }
  ↓
Returns PDF bytes + X-Saved-Filename + X-Saved-Version headers
```

**Critical:** Read `X-Saved-Version` header BEFORE `.blob()` — headers aren't accessible after consuming body.

---

## Data Formats

### scan-history.tsv (7 cols, no header past col 6)
```
url  first_seen  portal  title  company  status  location
```
Parsed by `parseScanHistory()` in `web/lib/parsers.ts`.

### applications.md
Markdown table: `# | Date | Company | Role | Score | Status | PDF | Report | Notes`  
NEVER add rows here directly — write TSV to `batch/tracker-additions/` + `node merge-tracker.mjs`.

### output/resumes/ naming
- v1: `Uday_Varmora_{SUFFIX}_Resume.pdf`
- v2+: `Uday_Varmora_{SUFFIX}_Resume_v2.pdf`
- Sidecar: `Uday_Varmora_{SUFFIX}_Resume.meta.json` (same base, `.meta.json` ext)

---

## Rules & Gotchas

1. **`projectRoot()`** — always use this for file access; never hardcode paths
2. **`export const runtime = "nodejs"` and `dynamic = "force-dynamic"`** on every API route — required for file system access
3. **Map iteration** — use `map.forEach((val, key) => {...})` not `for...of` — no `downlevelIteration` flag
4. **Radix UI tab clicks** in preview tool — use `elementFromPoint(x, y)?.click()` not `querySelector.click()`
5. **PDF iframe screenshots** always time out — use DOM eval (`preview_eval`) to verify iframe src/content
6. **Blob vs server URL** — `pdfUrl` can be `blob:` (fresh generate) or `/api/resumes/filename` (saved). Only revoke blob URLs.
7. **`X-Saved-Version` header** — read before consuming body as blob
8. **LibreOffice** must be installed for PDF generation. If missing, build.js exits 0 but no PDF is produced.
9. **`expRequired` and `expMinYears`** are in both `web/lib/types.ts` (global Job) AND the local Job interface inside `parsers.ts` — both must be updated if adding fields to Job
10. **Old resumes** in `output/` (prefixed `01_`, `02_`) are legacy; `output/resumes/` is the canonical store

---

## Adding a New Tab

1. Add icon import + `TabsTrigger` in `Dashboard.tsx`
2. Add `TabsContent` with new component in `Dashboard.tsx`
3. Add `"go-{tab}"` command to command palette array in `Dashboard.tsx`
4. Create component in `web/components/dashboard/`
5. Create API route(s) in `web/app/api/`

## Adding a New AI Task

1. Create `lib-ai/tasks/my-task.mjs` — export `buildMyTask(input) → { system, prompt }`
2. Import and export from `lib-ai/tasks/index.mjs`
3. Register in `lib-ai/registry.mjs`: add `'my_task': buildMyTask`
4. Add model chain in `config/ai.yml` under `tasks:`
5. Call via `POST /api/ai/my_task { input }` or `runTask('my_task', ...)` server-side
