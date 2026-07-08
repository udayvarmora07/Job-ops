# Jobops → SaaS Conversion Plan

Turning Jobops from a single-user (Uday's) tool into a **multi-tenant SaaS**
where any user signs up, provides their own career data (via resume upload,
LinkedIn, or manual entry), and gets their own job pipeline.

**Identity:** Supabase Auth (user UUID). **App data:** Supabase Postgres via
Prisma, keyed by that UUID. **Collection strategy:** minimal at onboarding,
enrich over time.

Legend: ✅ done · 🔲 todo · ⚙️ manual/ops step (you)

---

## ✅ Phase 0 — Foundation (DONE)

- ✅ Supabase Auth wired for **web + mobile** — email/password + Google/GitHub/
  LinkedIn buttons, session handling, route gate, sign-out.
  (`web/lib/supabase/*`, `web/app/login|signup|auth/*`, `web/middleware.ts`,
  `mobile/src/providers/AuthProvider.tsx`, `mobile/src/components/auth/*`)
- ✅ Supabase Postgres is the single DB — `DATABASE_URL` set, Prisma schema
  pushed, client generated, live query verified (`/api/applications` → 200).
- ✅ Auth gate verified — unauthenticated `/` → `/login`.
- ✅ `.gitignore` hardened so no `.env*` secret can be committed.

### ⚙️ Ops steps still needed from you
- ⚙️ **Rotate the DB password** (it was shared in chat) → Supabase → Settings →
  Database → Reset password → update `DATABASE_URL` in `.env` + `web/.env.local`.
- ⚙️ **Enable social providers** — Google/GitHub/LinkedIn are OFF. Register each
  OAuth app and paste client id/secret into Supabase → Auth → Providers, and add
  redirect URLs (`http://localhost:4317/auth/callback`, `jobops://auth-callback`).
  See [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md). (Email/password works today.)
- ⚙️ **For Docker/IPv4 cloud deploy:** swap `DATABASE_URL` to the "Session
  pooler" string from Supabase → Connect (direct host is IPv6-only).

---

## 🔲 Phase 1 — API identity helper

Make every API route know *who* is calling (web cookie **or** mobile bearer
token), so data can be scoped per user.

- 🔲 `web/lib/auth.ts`:
  - `getUserId(req?): Promise<string | null>` — resolve the Supabase user from
    the SSR cookie (`lib/supabase/server.ts`) or `Authorization: Bearer <token>`
    (verify via `supabase.auth.getUser(token)`).
  - `requireUserId(req)` — returns the id or throws a 401 `NextResponse`.
- Mobile already sends the token (`src/api/client.ts`) — no client change.

**Done when:** a signed-in web session and a mobile bearer token both resolve to
the same UUID; anonymous calls get 401.

---

## 🔲 Phase 2 — Data model (Prisma)

- 🔲 New model **`UserProfile`** (`prisma/schema.prisma`), `userId String @id`:
  - Identity: `email, fullName, phone, city, country, timezone, linkedinUrl,
    githubUrl, portfolioUrl`
  - Status: `employmentStatus, availability, visaStatus, onsiteAvailability`
  - Targeting: `targetRoles String[]`, `archetypes Json`, `superpowers String[]`,
    `proofPoints Json`
  - Comp: `compTargetRange, compCurrency, compMinimum, compFlexibility`
  - Referral net: `pastCompanies String[]`, `schools String[]`
  - CV: `cvMarkdown String?`, `cvStructured Json?`
  - Scan cfg: `scanKeywords String[]`, `targetCompanies String[]`
  - Onboarding: `essentialsComplete Boolean @default(false)`,
    `onboardingComplete Boolean @default(false)`, `createdAt/updatedAt`
- 🔲 Add nullable `userId String?` + `@@index([userId])` to per-user tables:
  `Application, Report, Resume, ScanHistory, PipelineItem, Outreach, Referral`.
  (Nullable → existing author rows stay valid; new rows stamp the caller.)
- 🔲 Sync: `npx prisma db push` (later adopt migration history with `migrate`).

**Done when:** `UserProfile` + `userId` columns exist in Supabase (`db push` ok).

---

## 🔲 Phase 3 — Profile API + onboarding gate

- 🔲 `GET /api/profile` — caller's `UserProfile` (auto-create empty row + seed
  `email`/`fullName` from the Supabase user on first hit).
- 🔲 `PUT /api/profile` — partial update (each wizard step saves as you go); sets
  `essentialsComplete` once name + target roles + location are present.
- 🔲 `GET /api/profile/status` — `{ essentialsComplete, onboardingComplete }`.
- 🔲 **Gate:** web `middleware.ts` — authed + `!essentialsComplete` + not on
  `/onboarding` → redirect to `/onboarding`. Mobile `app/_layout.tsx` — route to
  an `(onboarding)` group.

**Done when:** a fresh user lands on onboarding; saving essentials unlocks the
dashboard; `GET /api/profile` returns their row.

---

## 🔲 Phase 4 — Profile collection (3 methods)

Minimal-now: only **Essentials** (name, target roles, location) is required; the
rest is optional and can be filled later.

- 🔲 **Manual wizard** (web `app/onboarding/*` + `components/onboarding/*`,
  mobile `app/(onboarding)/*`) — multi-step, save-as-you-go, reuses existing
  `Input`/`Button` primitives.
- 🔲 **Resume upload + AI parse:**
  - New AI task `lib-ai/tasks/parse-resume.mjs` (mirror `tailor-cv-json.mjs`) →
    structured JSON; register in `lib-ai/run.mjs`/registry + `config/ai.yml`.
  - `POST /api/profile/parse-resume` — accept PDF/DOCX/text, extract text
    (add `pdf-parse`), run the task, return structured fields to **prefill the
    wizard** (user reviews/edits before save). Persists `cvMarkdown` +
    `cvStructured`.
- 🔲 **LinkedIn import** (best-effort, caveat shown in UI):
  - OIDC basics (name/email/picture) auto-seeded from the OAuth session.
  - `POST /api/profile/import-linkedin { url }` — reuse the Apify token-failover
    pattern from `web/app/api/referrals/find-people/route.ts` to scrape a public
    profile, then AI-normalize → prefill the wizard.
    *(ToS-gray, reliability varies — clearly labeled as optional.)*

**Done when:** each method populates the wizard; confirming persists to
`UserProfile`.

---

## 🔲 Phase 5 — Read per-user data everywhere

- 🔲 `web/lib/profile.ts`: add `loadProfileForUser(userId)` (DB → existing
  `CandidateProfile`); keep file `loadProfile()` as CLI fallback. Update
  `web/lib/suggest.ts` + `find-people/route.ts`.
- 🔲 **AI personalization**: thread the user's `cvMarkdown` as `baseContent` and
  inject their profile into prompts instead of the root files
  (`generate-cv-pdf`, `ai/evaluate-save`). Add an optional `userContext` arg to
  `lib-ai/context.mjs` builders (files stay the CLI default).
- 🔲 **Scope pipeline routes by `userId`** (filter on read, stamp on write):
  `applications, jobs, pipeline, reports, referrals, resumes, summary, outreach,
  scan, evaluate-save`. Routes still parsing flat files move to Prisma as the
  per-user source of truth. Per-user resume files write to a `userId`-scoped
  path (or object storage).

**Done when:** two users see only their own applications/reports; AI outputs use
the calling user's CV/profile.

---

## 🔲 Phase 6 — Settings + polish

- 🔲 Editable Profile/Settings (web view + flesh out mobile `app/profile.tsx`),
  reusing wizard step components.
- 🔲 "Enrich-later" nudges when optional sections are empty.
- 🔲 Typecheck clean (`npx tsc --noEmit`) for web + mobile.

---

## Delivery order
1. Phase 1 → 2 → 3 (plumbing: auth helper, schema, profile API + gate).
2. Phase 4 manual wizard (web, then mobile).
3. Phase 4 resume-parse, then LinkedIn.
4. Phase 5 per-user reads + pipeline scoping.
5. Phase 6 settings/polish.

## Out of scope (for now)
- Reworking the ~30 root `.mjs` CLI scripts for multi-user — they stay
  single-user/local (author workflow). SaaS runs through web + mobile + DB.
- Billing/subscriptions, team accounts, admin console.

## Verification (each phase)
- `preview_start` (career-web) + `preview_eval` fetch + `preview_snapshot` for
  web flows; typecheck both apps; two-user isolation check on pipeline data.
