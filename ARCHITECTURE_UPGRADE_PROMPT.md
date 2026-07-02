# Jobops Architecture Upgrade: PostgreSQL + Redis + BullMQ

Use this prompt in a **fresh chat session** to implement the full architecture upgrade.

---

## Project Overview

Jobops is an open-source AI job search pipeline. Current stack: Node.js/ESM scripts + Next.js 14 web dashboard + Playwright. Data is stored entirely in flat files (markdown, TSV, JSON) with a tiny SQLite cache (16 rows, no TTL). It's a CLI-first tool with an optional web dashboard.

**Purpose of this upgrade:** Convert Jobops into a proper self-hosted platform that anyone can deploy. Replace the flat-file data layer with PostgreSQL + Redis + BullMQ for performance, scalability, and reliability.

**Current data files to migrate:**
- `data/applications.md` — Application tracker (markdown table, ~40 entries)
- `data/pipeline.md` — Pipeline inbox (markdown checklist, ~679 lines)
- `data/scan-history.tsv` — Scanner dedup history (TSV, 628 lines, 7 cols)
- `data/outreach.json` — Cold outreach records (JSON array)
- `data/referrals.json` — Referral tracking (JSON array)
- `reports/*.md` — 31 evaluation reports
- `output/resumes/*.pdf + .meta.json` — Generated resumes
- `data/jobops.db` — SQLite ai_cache table (to be replaced by Redis)
- `data/jd-cache/*.json` — JD cache (to be replaced)

**Other project files (keep as-is):**
- `config/profile.yml`, `modes/`, `cv.md`, `article-digest.md` — User personalization
- `lib-ai/`, `providers/`, `templates/` — AI engine and templates
- `scan.mjs`, `scan-ats-full.mjs`, `check-liveness.mjs` — Scanner scripts
- `generate-pdf.mjs`, `generate-resumes*.mjs` — Resume generators
- `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs` — Pipeline scripts
- `ai.mjs`, `gemini-eval.mjs` — CLI eval entry points
- `portals.yml` — Portal config
- `uday-data/` — User-specific customizations (keep as example for others)

**Already has:**
- Dockerfile (Playwright-based)
- docker-compose.yml (single service, dev only)
- Go TUI dashboard (`dashboard/`)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose                               │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │   Next.js Web    │    │   BullMQ Worker  │    │   CLI Tools   │  │
│  │   (web/ dir)     │    │   (new: worker/  │    │   (existing)  │  │
│  │   port 4317      │    │    directory)    │    │               │  │
│  └────┬─────────────┘    └───────┬──────────┘    └───────┬───────┘  │
│       │                          │                        │         │
│       └──────────┬───────────────┘                        │         │
│                  │                                        │         │
│          ┌───────▼────────┐                      ┌───────▼───────┐ │
│          │     Redis      │                      │  PostgreSQL   │ │
│          │  (cache + Q)   │                      │  (database)   │ │
│          │  port 6379     │                      │  port 5432    │ │
│          └────────────────┘                      └───────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Prisma ORM (type-safe DB access, migrations, seed)          │   │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Why These Choices

| Layer | Choice | Reason |
|-------|--------|--------|
| **Database** | PostgreSQL 16 | Industry standard, battle-tested, free tier on Supabase/Neon, Docker support, JSONB, full-text search |
| **ORM** | Prisma | Type-safe, auto-generated types, migrations, excellent Next.js integration, query tracing |
| **Cache** | Redis 7 | Industry standard, powers both caching AND queue, Upstash free tier or Docker |
| **Queue** | BullMQ (Redis-backed) | Native Node.js, built-in job scheduling/retry/delay/concurrency, same Redis as cache |
| **Charts** | Recharts (keep) | Already used, React-native, good for dashboard analytics |

### Why NOT RabbitMQ

BullMQ on Redis does everything this project needs — job queues, delays, retries, concurrency control, rate limiting — without the operational complexity of an Erlang VM + AMQP broker:
- RabbitMQ: ~100MB+ memory, separate service, AMQP protocol overhead
- BullMQ: ~5MB overhead on existing Redis, native Node.js API, jobs are just Redis lists
- For a job search pipeline (enqueue → process → store results), BullMQ is the standard

### Why NOT SQLite

SQLite is great for single-user CLI apps. But for a self-hosted platform:
- No concurrent writes (single-writer)
- No user isolation
- No network access
- No rollback/point-in-time recovery
- Prisma doesn't support SQLite for some features

---

## Implementation Plan

### Step 1: Prisma Setup

Create `prisma/schema.prisma` with these models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Application {
  id        Int      @id @default(autoincrement())
  num       Int      @unique
  date      DateTime
  company   String
  role      String
  score     Float?
  status    String   @default("Evaluated")
  pdfUrl    String?
  reportUrl String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([company, role])
}

model ScanHistory {
  id         Int      @id @default(autoincrement())
  url        String   @unique
  firstSeen  DateTime
  portal     String
  title      String
  company    String
  status     String   @default("new")
  location   String?
  createdAt  DateTime @default(now())

  @@index([company])
  @@index([portal])
}

model PipelineItem {
  id        Int      @id @default(autoincrement())
  url       String   @unique
  status    String   @default("pending")  // pending, processing, done, skipped
  title     String?
  company   String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

model Report {
  id        Int      @id @default(autoincrement())
  num       Int      @unique
  company   String
  role      String
  score     Float?
  status    String   @default("draft")
  content   String   // Full markdown content
  pdfUrl    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([company])
}

model Outreach {
  id        Int      @id @default(autoincrement())
  company   String
  role      String?
  contact   String?
  email     String?
  subject   String?
  status    String   @default("draft")
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([company, status])
}

model Referral {
  id        Int      @id @default(autoincrement())
  company   String
  role      String?
  contact   String?
  channel   String?
  status    String   @default("identified")
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([company, status])
}

model Resume {
  id        Int      @id @default(autoincrement())
  company   String
  role      String
  filename  String   @unique
  version   Int      @default(1)
  metadata  Json?    // Sidecar JSON
  createdAt DateTime @default(now())

  @@index([company, role])
}

model AiCache {
  key       String   @id
  task      String
  scope     String?
  payload   Json
  model     String?
  expiresAt DateTime?
  createdAt DateTime @default(now())

  @@index([task])
  @@index([expiresAt])
}
```

### Step 2: Redis + BullMQ Setup

Create `worker/` directory:

```
worker/
├── index.mjs          — Worker entry point, starts consumers
├── queue.mjs          — BullMQ queue definitions
├── jobs/
│   ├── evaluate-job.mjs    — Process job evaluation
│   ├── scan-portals.mjs    — Run portal scan
│   ├── liveness-check.mjs  — Check job liveness
│   └── generate-pdf.mjs    — Generate resume PDF
├── Dockerfile         — Worker Docker image
└── package.json
```

Use `bullmq` npm package. Define queues:
- `evaluate` — Job evaluation (LLM calls)
- `scan` — Portal scanning
- `liveness` — URL liveness checks
- `pdf` — PDF generation

Worker communicates progress via `job.updateProgress()` and Redis pub/sub, which the Next.js dashboard listens to via SSE.

### Step 3: Initialize Prisma

```bash
cd web
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

Add `DATABASE_URL` to `.env`.

### Step 4: Migration Script

Create `scripts/migrate-from-files.mjs` that:
1. Reads `data/applications.md` → parses table → inserts into `Application` table
2. Reads `data/scan-history.tsv` → parses TSV → inserts into `ScanHistory` table
3. Reads `data/pipeline.md` → parses checklist → inserts into `PipelineItem` table
4. Reads `data/outreach.json` → inserts into `Outreach` table
5. Reads `data/referrals.json` → inserts into `Referral` table
6. Reads `reports/*.md` → extracts metadata → inserts into `Report` table
7. Reads `output/resumes/*.meta.json` → inserts into `Resume` table
8. Reads SQLite `data/jobops.db` ai_cache → imports into Redis via `AiCache` table or directly

### Step 5: Update Web Dashboard API Routes

Rewrite `web/app/api/` routes to use Prisma + Redis instead of flat files:

| Route | Current (flat file) | New (Prisma/Redis) |
|-------|--------------------|--------------------|
| `GET /api/summary` | Read TSV + Markdown | `prisma.application.groupBy()` + SQL aggregations |
| `GET /api/jobs` | Read scan-history.tsv | `prisma.scanHistory.findMany()` |
| `DELETE /api/jobs` | Rewrite TSV | `prisma.scanHistory.delete()` |
| `GET /api/applications` | Read applications.md | `prisma.application.findMany()` |
| `PATCH /api/applications` | Rewrite applications.md | `prisma.application.update()` |
| `GET /api/reports` | Glob reports/ dir | `prisma.report.findMany()` |
| `GET /api/pipeline` | Read pipeline.md | `prisma.pipelineItem.findMany()` |
| `POST /api/pipeline` | Append to pipeline.md | `prisma.pipelineItem.create()` |
| `DELETE /api/pipeline` | Rewrite pipeline.md | `prisma.pipelineItem.delete()` |
| `POST /api/scan` | Run scan.mjs directly | Enqueue BullMQ scan job, stream progress via SSE |
| `POST /api/evaluate-save` | Run LLM + write file | Enqueue BullMQ evaluate job, stream via SSE + write to DB |
| `GET /api/resumes` | Glob output/resumes/ | `prisma.resume.findMany()` |
| `GET /api/referrals/ai-targets` | SQLite cache | Redis cache with TTL |

### Step 6: Cache Layer

Create `web/lib/cache-redis.ts`:

```typescript
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const TTL = {
  evaluate_job: 7 * 24 * 60 * 60,    // 7 days
  tailor_cv: 30 * 24 * 60 * 60,      // 30 days
  cover_letter: 30 * 24 * 60 * 60,   // 30 days
  interview_prep: 14 * 24 * 60 * 60, // 14 days
  search_people: 24 * 60 * 60,       // 1 day
  dashboard_stats: 5 * 60,           // 5 minutes
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export function cacheKey(task: string, ...parts: string[]): string {
  return `jobops:${task}:${parts.join("|").toLowerCase().replace(/\s+/g, " ").trim()}`;
}
```

Keep the file-based JD cache (`data/jd-cache/`) as a short-term backup for offline use, but add Redis as the primary cache layer.

### Step 7: Docker Compose Update

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: jobops
      POSTGRES_USER: jobops
      POSTGRES_PASSWORD: jobops
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jobops"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "4317:4317"
    environment:
      DATABASE_URL: postgresql://jobops:jobops@postgres:5432/jobops
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./data:/app/data
      - ./output:/app/output
      - ./reports:/app/reports
      - ./config:/app/config

  worker:
    build:
      context: .
      dockerfile: worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://jobops:jobops@postgres:5432/jobops
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./data:/app/data
      - ./output:/app/output
      - ./reports:/app/reports
      - ./config:/app/config
    deploy:
      replicas: 2  # Scale workers horizontally

volumes:
  pgdata:
```

### Step 8: SSE Streaming for Job Progress

The web dashboard already uses SSE (`web/app/api/ai/[task]/route.ts`). Extend this pattern:
- Worker publishes progress to Redis pub/sub channel: `job:{jobId}:progress`
- Web API route subscribes to Redis pub/sub, forwards events to browser SSE
- Frontend shows real-time progress bar for evaluations/scans

### Step 9: CLI Backward Compatibility

Keep all existing CLI scripts working for users who prefer the terminal. Add a flag `--db` to use PostgreSQL instead of flat files:
```bash
node ai.mjs eval --url https://... --db   # Uses PostgreSQL
node ai.mjs eval --url https://...        # Uses flat files (default, backward compat)
```

The flat-file code paths stay as fallback. The Prisma/Redis paths are the default in Docker.

### Step 10: Quick Start for Users

Create `QUICKSTART.md`:

```markdown
# Quick Start

## Option 1: Docker (Recommended)
```bash
docker compose up -d
npx prisma db push
node scripts/migrate-from-files.mjs
```

## Option 2: Self-hosted with free tiers
```bash
# Create Supabase project (free) → get DATABASE_URL
# Create Upstash Redis (free) → get REDIS_URL
# Create Neon PostgreSQL (free) → DATABASE_URL

echo "DATABASE_URL=postgresql://..." >> .env
echo "REDIS_URL=redis://..." >> .env

npm install
npx prisma generate
npx prisma db push
node scripts/migrate-from-files.mjs
npm run dev
```

## Option 3: CLI-only (no Docker, no web)
```bash
# Keep using flat files as before
node ai.mjs eval --url https://...
```
```

---

## Files to Create/Modify

### New Files
1. `prisma/schema.prisma` — Database schema
2. `web/lib/cache-redis.ts` — Redis cache layer
3. `worker/index.mjs` — Worker entry point
4. `worker/queue.mjs` — Queue definitions
5. `worker/jobs/evaluate-job.mjs` — Job evaluation processor
6. `worker/jobs/scan-portals.mjs` — Scan processor
7. `worker/jobs/liveness-check.mjs` — Liveness processor
8. `worker/jobs/generate-pdf.mjs` — PDF generation processor
9. `worker/Dockerfile` — Worker image
10. `worker/package.json` — Worker dependencies
11. `scripts/migrate-from-files.mjs` — Migration script
12. `QUICKSTART.md` — User onboarding
13. `.env.example` — Updated with DATABASE_URL + REDIS_URL

### Modified Files
1. `docker-compose.yml` — Add postgres, redis, worker services
2. `web/package.json` — Add prisma, @prisma/client, ioredis
3. `web/lib/cache.ts` — Add Redis-backed methods alongside SQLite
4. `web/app/api/summary/route.ts` → Use Prisma
5. `web/app/api/jobs/route.ts` → Use Prisma
6. `web/app/api/applications/route.ts` → Use Prisma
7. `web/app/api/reports/route.ts` → Use Prisma
8. `web/app/api/pipeline/route.ts` → Use Prisma
9. `web/app/api/scan/route.ts` → Use BullMQ
10. `web/app/api/evaluate-save/route.ts` → Use BullMQ
11. `web/lib/paths.ts` — Add DB config
12. `web/lib/types.ts` — Add Prisma types
13. `.env` — Add DATABASE_URL, REDIS_URL

---

## npm Dependencies to Add

```bash
# Web dashboard
npm install prisma @prisma/client ioredis bullmq
npm install -D @types/ioredis

# Worker (separate package.json in worker/)
npm install bullmq ioredis @prisma/client prisma playwright dotenv js-yaml
```

---

## Migration Order

1. Set up Prisma schema + generate client
2. Create Redis cache layer
3. Create BullMQ worker + queues
4. Write migration script (flat files → DB)
5. Rewrite API routes one by one (summary → apps → pipeline → scan → evaluate)
6. Update Docker Compose
7. Add SSE progress streaming
8. Write QUICKSTART.md
9. Test end-to-end: `docker compose up` → run migration → use dashboard

---

## Design Principles to Follow

1. **Backward compatibility**: CLI scripts must still work with flat files. The DB is additive.
2. **Graceful degradation**: If Redis is down, fall back to in-memory cache. If PostgreSQL is down, fall back to flat files.
3. **Single source of truth**: After migration, flat files are the import source. Once data is in DB, DB is the source of truth for the web dashboard. Flat files are read-only fallback.
4. **No data loss**: Migration script must be idempotent (safe to re-run). Use `ON CONFLICT DO NOTHING` / upsert.
5. **Type safety**: Prisma generates TypeScript types. Use them everywhere.
6. **SEO / public docs**: Add OpenGraph tags to dashboard pages. Create public job board pages if desired.

---

## Expected Outcome

After implementation:
- **Faster dashboard**: 5ms page loads (cached) instead of 200ms+ flat file reads
- **Real-time progress**: Job evaluations stream progress via SSE
- **Scalable**: 2+ worker replicas process evaluations in parallel
- **Reliable**: BullMQ retries failed LLM calls, survives crashes
- **Deployable**: One `docker compose up` runs everything
- **Free tier friendly**: Supabase + Upstash = $0 to start
- **Backward compatible**: CLI still works, flat files still work
