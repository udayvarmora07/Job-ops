# Uday Varmora — Resume System Reference

## Complete Project Flow

### Directory Map

```
jobops/
├── uday-data/                          ← Your resume tailoring system
│   ├── 01_MASTER_BRIEF.md              ← SINGLE SOURCE OF TRUTH. All facts, metrics, tiers
│   ├── 02_JD_TAILORING_PROMPT.md       ← Workflow prompt for AI (5-step JD→resume process)
│   ├── 03_HOW_TO_USE.md                ← Instructions for using the system (3 options)
│   ├── 04_build_template.js.md         ← Legacy template for standalone build scripts
│   ├── REFERENCE.md                    ← THIS FILE — quick reference per session
│   └── resume-system/
│       ├── README.md                   ← System docs (format rules, build commands)
│       ├── build.js                    ← BUILD ENGINE: reads .json → .docx → .pdf, auto-fits 1 page
│       ├── resume-builder.js           ← LAYOUT ENGINE: fixed format (Calibri, navy, 10pt, US Letter)
│       └── content/                    ← Per-job JSON files (tailored wording)
│           ├── universal.json          ← Master baseline (copy to start a new one)
│           ├── exxonmobil-devops-engineer.json
│           └── ...
├── output/                             ← Generated .docx + .pdf files (gitignored)
├── cv.md                               ← Canonical CV (user layer, never auto-updated)
├── config/profile.yml                  ← User profile (user layer)
├── modes/                              ← System modes for evaluation (system layer)
├── data/                               ← Trackers, scan history, pipeline
├── reports/                            ← Evaluation reports
└── templates/                          ← CV templates, states.yml
```

### Workflow: Tailor Resume for a New Job

```
STEP 1: Fetch the JD (webfetch or browser)
STEP 2: Analyze JD → Map keywords to MASTER BRIEF tiers
STEP 3: Copy content/universal.json → content/<company>-<role>.json
STEP 4: Edit content JSON:
        - filenameSuffix (controls output file name)
        - summary (reframe for JD, keep compact — 2 lines max)
        - skills (reorder rows: JD priorities first)
        - experience bullets (pick 4-5 from Brief library B1-B10)
        - projects (pick 2-3 best-fit bullets per project)
        - achievements (omit unless JD asks for certs)
STEP 5: Build → node uday-data/resume-system/build.js uday-data/resume-system/content/<file>.json
STEP 6: Verify output says "pages: 1" and spacing is "fill ×1.0x" (not "dense" or "denser")
```

### Build Engine (build.js) — How Page-Fitting Works

The build system solves the 1-page constraint with a TWO-PHASE approach:

```
PHASE 1 — Baseline: render at "normal" spacing (factor 1.0)
├── If pages > 1 → PHASE 1a SHRINK: try "dense" → "denser" presets until ≤1 page
└── If pages ≤ 1 → PHASE 1b EXPAND: binary search 1.0 → 1.6 for max fill factor

PHASE 2 — Deliver: keep the best result as the final file
```

**KEY INSIGHT:** To get a HIGHER fill factor (better page fill), make content SHORTER.
- Content too long → SHRINK path ("dense"/"denser") → tighter, more cramped
- Content mid-range → EXPAND path → optimal spacing (target: fill ×1.15 to ×1.35)
- Content too short → max fill at 1.6 (still looks fine, just more air)

**Fill factor visual guide:**
- ×1.00 = normal spacing (might have small bottom gap)
- ×1.06 = subtle expansion (6% more spacing)
- ×1.15-×1.35 = optimal (well-balanced, professional look)
- ×1.60 = max expansion (noticeably airy, only for very short content)

### Resume Builder (resume-builder.js) — Layout Constants

| Property | Value |
|----------|-------|
| Font | Calibri |
| Name size | 16pt bold centered |
| Body size | 10pt |
| Skills size | 10pt |
| Project tech | 9.5pt italic gray |
| Section headers | 11pt bold navy (accent underline) |
| Margins | 25pt top/bottom, 0.5" left/right |
| Page size | US Letter (12240 × 15840 twips) |
| Default color | Navy `#1B3A6B` (enterprise) |
| Alt color | Teal `#0F766E` (startup) |

### Content JSON Fields

| Field | Type | Notes |
|-------|------|-------|
| `filenameSuffix` | string | Controls output name: `Uday_Varmora_{suffix}_Resume` |
| `title` | string | Document title (not visible on resume) |
| `colorScheme` | `"navy"` or `"teal"` | Navy for enterprise, teal for startup |
| `summary` | string | Keep 2 lines max (with 10pt + 0.5" margins ≈ 300 chars) |
| `skills` | `[["Cat", "items"], ...]` | 8 rows, each ≤115 chars to fit 1 line |
| `experience` | array of `{role, org, dates, bullets[]}` | 4-5 full-time + 1-2 intern bullets |
| `projects` | array of `{title, tech, bullets[]}` | 3 projects, 1-3 bullets each |
| `education` | `{left, right}` | Left = degree + school, Right = years |
| `achievements` | string[] | Omit unless JD asks (never fabricate) |

### Critical Honesty Rules (from MASTER BRIEF)

- EKS upgrade is **v1.33 → v1.34** only — never change version numbers
- Experience = **"1+ year"** — never "1.5 years" or specific months
- **Tier 3** = `Azure (Fundamentals)` framing only
- **NEVER CLAIM:** Go, GCP, Chaos Engineering, OpenTelemetry, ML/AI infra
- British **-ise** spelling: Dockerised, containerised
- Only **anchor metrics** from Brief section 3 may appear — no invented numbers
- Certifications: **omit by default** — include ONLY if JD explicitly asks

### Tone Reframing by Role

| Role | Verbs | Frame |
|------|-------|-------|
| DevOps Engineer | Designed, Automated, Provisioned, Maintained | Pipeline volume + automation + uptime |
| SRE | Sustained, Drove, Authored, Eliminated | SLOs/MTTR/toil/runbooks |
| Cloud Engineer | Architected, Designed, Operated, Provisioned | AWS depth + architecture + cost |
| BFSI/Enterprise | Governed, Standardized, Audited, Hardened | Compliance/audit/least-privilege |
| Platform Engineer | Built, Enabled, Standardized | Internal platform + dev experience |
| Startup/SaaS | Owned, Built, Shipped | Ownership + speed + breadth |

### Referral Workflow

1. Check `config/profile.yml` for `past_companies` and `schools`
2. Search Apify: `fabri-lab/linkedin-public-search-lead-extractor` with APIFY_TOKEN from `.env`
3. Search patterns:
   - `"<job_company>" + "<past_company>"` (former colleagues)
   - `"<job_company>" + "<school>"` (alumni)
   - `"<job_company>" + "<target_role>"` (direct peers)
4. Generate 2-3 referral targets with LinkedIn connection notes

### Quick Commands

```bash
# Build a resume
node uday-data/resume-system/build.js uday-data/resume-system/content/<file>.json

# Merge tracker after evaluations
node merge-tracker.mjs

# Verify pipeline integrity
node verify-pipeline.mjs

# Normalize statuses
node normalize-statuses.mjs

# Dedup tracker
node dedup-tracker.mjs

# Check for system update
node update-system.mjs check

# Doctor check (cold-start / onboarding)
node doctor.mjs --json
```

### Session Start Checklist

1. Run `node update-system.mjs check` silently
2. Run `node doctor.mjs --json` silently
3. Check linkedin/job URL in pipeline.md for new jobs
4. Read the job's JD (webfetch LinkedIn + company careers page)
5. Read `config/profile.yml` for user preferences + referral network
6. If eval needed → read relevant mode from `modes/`
7. If resume needed → read `01_MASTER_BRIEF.md` + use resume-system/
