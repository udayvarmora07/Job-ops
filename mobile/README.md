# Jobops Mobile

Cross-platform iOS + Android app for the Jobops job-search pipeline, built with
Expo (React Native) + TypeScript. See [`../MOBILE_APP_ROADMAP.md`](../MOBILE_APP_ROADMAP.md)
for the full plan.

## Status — Full feature parity with the web dashboard ✅

The mobile app now mirrors every section of the web dashboard, wired to the
real backend (Next.js API on **:4317**, CORS-enabled):

| Feature | Screen |
|---------|--------|
| Dashboard | stats, pipeline funnel, conversion rates, quick links, recent apps |
| Jobs | browser + search + job detail |
| Applications | tracker + status filter + **detail with live status update (PATCH)** |
| Reports | list + detail (markdown rendered from backend) |
| Pipeline | list + add/remove URL |
| Resumes | version groups + open PDF |
| Referrals | list |
| Outreach | list |
| Profile | account + backend info |
| **Evaluate (AI)** | paste JD / job URL → AI fit score + saved report |
| **Scan** | trigger portal scan → new-jobs summary |
| **Résumé generation** | generate a tailored CV from a job |
| **Resume QA** | ATS / keyword review of a résumé |
| **Job actions** | evaluate, generate résumé, delete |
| **AI Studio** | cover letter · interview prep · connection notes (AI text) |
| **Add / delete referral** | manage referral contacts |
| **Add application** | log an application manually |
| **Referral finder** | suggest personas · AI targets · connection notes · find people (LinkedIn) |
| **Outreach composer** | compose email · find email · send (SMTP) |

**Full parity with the web dashboard.** Every dashboard feature is now on mobile.

Navigation: bottom tabs (Home · Jobs · Tracker · Reports · More); More hub →
Pipeline · Resumes · Referrals · Outreach · Profile.

Verified end-to-end (Playwright) against the live backend: **22/22 checks,
0 console errors**, including a real status PATCH persisted to Postgres.

### Run against the real backend

```bash
# 1. backend (repo root): DB + dashboard API on :4317
docker compose up -d postgres redis
cd web && npx next dev -p 4317

# 2. mobile (points at http://localhost:4317 by default)
cd mobile && npm run start   # or: npx expo start --web
```

On a physical device set `EXPO_PUBLIC_API_URL=http://<lan-ip>:4317`. If the
backend is unreachable, the app falls back to bundled demo data automatically.

## Phase 1: Foundation ✅

Implemented:

- Expo Router navigation (auth group + bottom tabs)
- Auth (Supabase-ready, with dev-bypass when unconfigured)
- Dashboard with live stats + recent applications
- Job browser (search, pull-to-refresh) + job detail
- Application tracker (status filters)
- Profile / sign-out
- TanStack Query data layer wired to the existing Next.js backend
  (`/api/jobs`, `/api/applications`, `/api/summary`)
- NativeWind (Tailwind) design system + reusable UI primitives

Next up (Phases 2–3): push notifications, evaluation SSE streaming, offline
cache, resume/CV viewer. See the roadmap.

## Quick start

```bash
cd mobile
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL to your backend

# Run the Jobops web backend first (from repo root):
#   cd web && npm run dev      # serves http://localhost:3000

npm run start             # then press i (iOS), a (Android), or w (web)
```

> On a physical device, `localhost` points at the phone. Set
> `EXPO_PUBLIC_API_URL` to your dev machine's LAN IP (e.g. `http://192.168.1.20:3000`).

## Auth

Supabase Auth is optional. Leave `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` empty and the app runs in **dev-bypass** mode —
any credentials sign you in locally so you can develop against the backend
without setting up Supabase. Fill them in to enable real email/OAuth auth.

## Demo mode (offline data)

If the backend is **unreachable** (e.g. running in Expo Go on a phone with no
dev server on `localhost:3000`), data requests automatically fall back to
bundled sample data and a **"Demo data — backend offline"** banner appears. This
keeps the whole app explorable with zero backend. Only *network* failures fall
back — real HTTP errors (4xx/5xx) still surface so backend bugs stay visible.
Disable with `EXPO_PUBLIC_DEMO_FALLBACK=0`. To see live data, set
`EXPO_PUBLIC_API_URL` to a reachable backend (see below).

## Testing on a physical Android phone (recommended)

The emulator needs a lot of RAM; a real phone via **Expo Go** is lighter and
faster — the laptop only runs Metro.

```bash
cd mobile
# bind Metro to your machine's LAN IP so the phone can reach it
REACT_NATIVE_PACKAGER_HOSTNAME=<your-lan-ip> npx expo start --lan --max-workers 2
```

1. Install **Expo Go** from the Play Store.
2. Scan the QR printed in the terminal (or enter `exp://<your-lan-ip>:8081`).
3. Sign in with any email/password (dev-bypass). Data shows in demo mode until
   you point `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000` at the running
   backend.

> Low on RAM? Cap Metro with `--max-workers 2` and
> `NODE_OPTIONS=--max-old-space-size=768`, and close memory-heavy apps
> (browsers) while the dev server runs.

## Quality gates

All green as of the QA pass:

```bash
npm run typecheck   # tsc --noEmit — clean
npm run lint        # ESLint — 0 errors, 0 warnings
npm test            # Jest — 6/6 flow tests pass
```

Native module versions are aligned to Expo Go SDK 52 (`react-native@0.76.9`,
`react-native-safe-area-context@4.12.0`, `react-native-gesture-handler@2.20.2`)
to avoid runtime crashes in Expo Go.

## Project layout

```
app/            Expo Router routes ((auth), (tabs), job/[url])
src/
  api/          Backend client + per-resource calls
  components/   UI primitives + domain components
  constants/    Theme tokens + runtime config
  hooks/        TanStack Query hooks
  providers/    Query, Auth, Supabase
  types/        Shared models (mirror backend API shapes)
  utils/        Formatting, secure storage
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start` | Start Metro / Expo dev server |
| `npm run ios` / `android` / `web` | Launch a platform |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Jest |
