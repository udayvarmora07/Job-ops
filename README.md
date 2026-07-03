# Jobops

> AI-powered, full-stack job search platform — evaluate offers, tailor CVs, scan portals, and track your pipeline from a CLI, a web dashboard, or your phone.

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-000?style=flat&logo=anthropic&logoColor=white" alt="Claude Code">
  <img src="https://img.shields.io/badge/OpenCode-Ready-111827?style=flat&logo=terminal&logoColor=white" alt="OpenCode">
  <img src="https://img.shields.io/badge/Gemini_CLI-4285F4?style=flat&logo=google&logoColor=white" alt="Gemini CLI">
  <img src="https://img.shields.io/badge/Next.js-000?style=flat&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white" alt="Expo">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/BullMQ-EA2027?style=flat&logo=redis&logoColor=white" alt="BullMQ">
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT">
</p>

---

## What is Jobops

Jobops turns your job search into an AI-driven pipeline instead of a spreadsheet. It reads your CV, reasons about each job description (not keyword matching), scores fit across weighted dimensions, generates ATS-optimized CVs and cover letters, and keeps everything in one tracked source of truth.

It runs three ways, all backed by the same evaluation engine and data:

- **CLI** — drive it from any agentic coding CLI (Claude Code, OpenCode, Gemini CLI, Qwen). Paste a URL, get a full evaluation + PDF + tracker entry.
- **Web dashboard** — a Next.js app to browse your pipeline, run scans, generate PDFs, and manage outreach/referrals from the browser.
- **Mobile app** — an Expo/React Native client to review jobs and applications on the go.

Heavy work (evaluations, scans, PDF generation, liveness checks) runs asynchronously on a Redis-backed **BullMQ** worker, with **PostgreSQL** as the system of record.

> **This is a filter, not a spray-and-pray tool.** Jobops helps you find the few offers worth your time out of hundreds. It recommends against applying to anything scoring below 4.0/5, and it **never auto-submits** — you always review and decide.

> **The first evaluations won't be great — that's expected.** The system doesn't know you yet. Feed it your CV, your story, your proof points and preferences. The more context you give it, the sharper it gets.

---

## Architecture

```
                        ┌─────────────────────────────────────┐
   CLI  (Claude/        │            Jobops core              │
   OpenCode/Gemini) ───▶│   modes/ · Node (.mjs) scripts ·    │
                        │   Playwright · Go scanner           │
   Web  (Next.js) ─────▶│                                     │
                        └───────────────┬─────────────────────┘
   Mobile (Expo) ──────▶                │
                              ┌─────────▼──────────┐
                              │   BullMQ worker    │  evaluate · scan
                              │   (Redis queue)    │  pdf · liveness
                              └─────────┬──────────┘
                                        │
                              ┌─────────▼──────────┐
                              │   PostgreSQL       │  Application · Report
                              │   (Prisma models)  │  Pipeline · Outreach …
                              └────────────────────┘
```

| Component | Path | Stack |
|-----------|------|-------|
| **Core engine** | `modes/`, `*.mjs` | Node.js (ESM), Playwright, YAML/Markdown |
| **Web dashboard** | `web/` | Next.js 15, React 19, Prisma, shadcn/Radix, Tailwind, Framer Motion, Recharts |
| **Mobile app** | `mobile/` | Expo, React Native, expo-router, NativeWind, Supabase auth, React Query |
| **Background worker** | `worker/` | BullMQ + ioredis (`evaluate-job`, `generate-pdf`, `liveness-check`, `scan-portals`) |
| **Portal scanner** | `scanner/` | Native Go (Greenhouse / Ashby / Lever APIs, reverse lookup) |
| **Terminal dashboard** | `dashboard/` | Go + Bubble Tea + Lipgloss |
| **Database** | `prisma/schema.prisma` | PostgreSQL 16 — `Application`, `Report`, `PipelineItem`, `Outreach`, `Referral`, `Resume`, `ScanHistory`, `AiCache` |
| **Infra** | `docker-compose.yml` | Postgres 16 + Redis 7 + web + worker |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive.

---

## Features

| Feature | Description |
|---------|-------------|
| **Auto-pipeline** | Paste a URL or JD → structured evaluation + ATS PDF + tracker entry |
| **A–G evaluation** | Role summary, CV match, level strategy, comp research, personalization, interview prep (STAR+R), plus a posting-legitimacy check that flags scams and ghost jobs |
| **ATS CV & cover letters** | Keyword-injected CVs and research-backed cover letters, rendered to A4 PDF via HTML + Playwright |
| **Portal scanner** | Pre-configured companies + custom queries across Ashby, Greenhouse, Lever, Wellfound — plus a zero-token Go scanner |
| **Outreach & referrals** | Find company emails, draft LinkedIn/email outreach, suggest referral targets and connection notes (web API) |
| **Background jobs** | Long-running evaluations, scans, PDFs and liveness checks run on a BullMQ worker, not in your terminal |
| **Interview story bank** | Accumulates STAR+Reflection stories across evaluations into a reusable set |
| **Pipeline integrity** | Automated merge, dedup, status normalization, and health checks |
| **Human-in-the-loop** | AI evaluates and recommends; you decide and submit. It never applies for you |

---

## Quick Start

### Prerequisites

- **Node.js 20+** and npm
- **Go 1.22+** (for the scanner / terminal dashboard — optional)
- **Docker** (recommended for Postgres + Redis) or local Postgres 16 & Redis 7
- An agentic CLI if you want the CLI workflow: [Claude Code](https://claude.ai/code), [OpenCode](https://opencode.ai), or [Gemini CLI](https://github.com/google-gemini/gemini-cli)

### 1. Clone & install

```bash
git clone https://github.com/udayvarmora07/Job-ops.git
cd Job-ops
npm install
npx playwright install chromium   # for PDF generation & liveness checks
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in what you use: DATABASE_URL, REDIS_URL, and any AI/scan API keys.
# .env is gitignored — your secrets never get committed.
```

### 3. Bring up infrastructure

```bash
docker compose up -d postgres redis    # Postgres 16 + Redis 7
npx prisma migrate deploy              # apply the schema
```

### 4. Verify setup

```bash
npm run doctor        # validates prerequisites & config
```

### 5. Add your profile

```bash
cp config/profile.example.yml config/profile.yml   # your details
cp templates/portals.example.yml portals.yml        # companies to scan
# Create cv.md in the project root with your CV in Markdown.
```

Or just open your CLI in the project and let it walk you through setup by chatting:

```bash
claude   # or: opencode / gemini / qwen
```

---

## Running each surface

**CLI** — one slash command, many modes:

```
/jobops                → show all commands
/jobops {paste a JD}   → full auto-pipeline (evaluate + PDF + tracker)
/jobops scan           → scan portals for new offers
/jobops pdf            → generate an ATS-optimized CV
/jobops cover          → cover letter generator
/jobops batch          → batch-evaluate multiple offers
/jobops tracker        → view application status
/jobops apply          → assist filling application forms
/jobops contacto       → LinkedIn/email outreach message
/jobops deep           → deep company research
```

**Web dashboard:**

```bash
cd web
npm install
npm run dev            # http://localhost:4317
```

**Background worker** (processes queued evaluations, scans, PDFs):

```bash
cd worker
npm install
node index.mjs
```

**Mobile app:**

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your web backend
npm start              # Expo dev server (iOS / Android / web)
```

**Go portal scanner** (zero-token discovery):

```bash
cd scanner
go run ./cmd/scanner
# or from the root Node engine:
npm run scan           # add --verify for Playwright liveness checks
```

**Terminal dashboard:**

```bash
npm run serve:dashboard   # Go TUI over your pipeline
```

---

## Project Structure

```
Job-ops/
├── AGENTS.md            # Canonical agent instructions (all CLIs)
├── CLAUDE.md            # Claude Code wrapper
├── OPENCODE.md          # OpenCode wrapper
├── cv.md                # Your CV (create this)
├── config/              # profile.yml + AI config
├── modes/               # Skill modes (evaluate, scan, pdf, cover, batch, …)
├── templates/           # CV templates, portals example, canonical states
├── batch/               # Batch worker prompt + runner
├── web/                 # Next.js web dashboard (jobops-web)
├── mobile/              # Expo / React Native app (jobops-mobile)
├── worker/              # BullMQ background jobs
├── scanner/             # Go portal scanner
├── dashboard/           # Go TUI pipeline viewer
├── prisma/              # PostgreSQL schema
├── docker-compose.yml   # Postgres + Redis + web + worker
├── data/ reports/ output/   # Your tracked data & artifacts (gitignored)
└── docs/                # Setup, architecture, customization, scripts
```

Key docs: [SETUP](docs/SETUP.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [CUSTOMIZATION](docs/CUSTOMIZATION.md) · [SCRIPTS](docs/SCRIPTS.md) · [AI briefing](docs/AI_BRIEFING.md)

---

## Customization

Jobops is designed to be customized **by your AI CLI itself** — it reads the same files it uses, so it knows exactly what to edit. Just ask:

- *"Change the archetypes to backend engineering roles"*
- *"Add these 5 companies to portals.yml"*
- *"Adjust the scoring weights toward remote-first roles"*
- *"Update my profile from this CV I'm pasting"*

Personalization lives in **your** files (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`), which are never overwritten by system updates. See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md).

---

## Security & Data

- **Your data stays local.** CVs, profiles and tracking data live on your machine and are sent only to the AI provider you choose.
- **Secrets are gitignored.** `.env`, `node_modules`, and build output (`.next/`) are excluded from version control. Never commit real API keys — use `.env.example` as the template.
- **No auto-submit.** The system drafts and recommends but never sends an application on your behalf.

---

## Credits

Jobops builds on the open-source **[jobops / career-ops](https://github.com/santifer/career-ops)** project by [santifer](https://santifer.io), extended here with a web dashboard, mobile app, and a PostgreSQL + Redis + BullMQ backend. Licensed under [MIT](LICENSE).

---

## License

[MIT](LICENSE) — provided "as is", without warranty of any kind. You are responsible for complying with the Terms of Service of any job portals you interact with. Evaluations are AI-generated recommendations, not guarantees.
