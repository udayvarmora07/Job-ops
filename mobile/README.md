# Jobops Mobile

Cross-platform iOS + Android app for the Jobops job-search pipeline, built with
Expo (React Native) + TypeScript. See [`../MOBILE_APP_ROADMAP.md`](../MOBILE_APP_ROADMAP.md)
for the full plan.

## Status — Phase 1: Foundation ✅

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
