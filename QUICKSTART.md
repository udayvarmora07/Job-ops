# Quick Start

## Option 1: Docker (Recommended)

```bash
docker compose up -d
npx prisma db push
node scripts/migrate-from-files.mjs
```

This starts PostgreSQL, Redis, the web dashboard (port 4317), and 2 worker replicas.

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

## Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐
│   Next.js Web    │    │   BullMQ Worker  │    │   CLI Tools   │
│   (web/ dir)     │    │   (worker/ dir)  │    │   (existing)  │
│   port 4317      │    │                  │    │               │
└────┬─────────────┘    └───────┬──────────┘    └───────┬───────┘
     │                          │                        │
     └──────────┬───────────────┘                        │
                │                                        │
        ┌───────▼────────┐                      ┌───────▼───────┐
        │     Redis      │                      │  PostgreSQL   │
        │  (cache + Q)   │                      │  (database)   │
        └────────────────┘                      └───────────────┘
```

## Migration from v1.10

All user data (CV, profile, reports, tracker) stays in flat files. The `--db` flag enables PostgreSQL:

```bash
node ai.mjs eval --url https://... --db   # Uses PostgreSQL
node ai.mjs eval --url https://...        # Uses flat files (default)
```
