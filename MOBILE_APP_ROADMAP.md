# Career-Ops Mobile App — Complete Roadmap

## Summary

Build a cross-platform iOS + Android mobile app for Career-Ops using **React Native with Expo**. Users can browse jobs, track applications, receive push notifications for new matches, and manage their entire job search from their phone.

---

## Skills Found (via `npx skills find`)

Install these for mobile development assistance in your AI coding sessions:

```bash
# Core
npx skills add mindrally/skills@expo-react-native-typescript     # 1.4K — Expo + RN + TypeScript
npx skills add pproenca/dot-skills@expo-react-native-performance  # 911  — Performance optimization

# iOS platform-specific
npx skills add dpearson2699/swift-ios-skills@swiftui-patterns     # 2.7K — iOS native patterns
npx skills add dpearson2699/swift-ios-skills@push-notifications   # 2.4K — Push notifications

# Testing
npx skills add petrkindlmann/qa-skills@mobile-testing             # 87   — Mobile QA/testing
npx skills add thebeardedbearsas/claude-craft@testing-reactnative # 131  — RN testing

# Deploy
npx skills add aj-geddes/useful-ai-prompts@app-store-deployment   # 501  — App Store submission

# UI/UX (already installed)
# ui-ux-pro-max — covers mobile UI design, animations, accessibility
```

---

## Architecture Decision

### Why Expo (React Native) Over Alternatives

| Factor | Expo (RN) | Flutter | KMP + SwiftUI Native |
|--------|-----------|---------|----------------------|
| **Shared code** with existing Next.js web | **TypeScript types, API client, data models** | None (Dart) | None |
| **Team skills reuse** | Same React + TS as web dashboard | New language (Dart) | Kotlin + Swift |
| **Library ecosystem** | Vast (npm) | Good (pub.dev) | Fragmented |
| **Push notifications** | Expo Push API (built-in) | Firebase Cloud Messaging | APNs + FCM separately |
| **OTA updates** | Expo Updates (built-in) | Shorebird (paid) | Not possible |
| **Build pipeline** | EAS Build (SaaS) | Codemagic (3rd party) | Xcode + Gradle |
| **Time to MVP** | ~2 months | ~3 months | ~5 months |
| **Job board UI kits** | Many (react-native-paper, nativebase) | Fewer | None |

**Verdict:** Expo is the clear choice — same TypeScript stack, share types/models/client with the Next.js web dashboard, fastest path to iOS + Android.

---

## App Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Auth       │  │   Job       │  │   Application   │  │
│  │   (Supabase) │  │   Browser   │  │   Tracker       │  │
│  └──────┬───────┘  └──────┬──────┘  └───────┬─────────┘  │
│         │                 │                  │            │
│  ┌──────▼─────────────────▼──────────────────▼─────────┐  │
│  │              Shared Layer (types, API client, hooks) │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          │ HTTPS + WebSocket/SSE
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Existing Career-Ops)               │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Next.js │  │   Go     │  │  Redis   │  │  PG    │ │
│  │  Web API │  │  Scanner │  │(cache+Q) │  │  DB    │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Shared Code (mobile/ + web/)

Create a `packages/shared/` directory:

```
packages/
  shared/
    src/
      types/          — Job, Application, PipelineItem, Report, etc.
      api-client/     — Unified API client (fetch wrapper, auth, error handling)
      hooks/          — Shared React hooks (useJobs, useApplications, etc.)
      utils/          — Date formatting, URL normalization, filter helpers
    package.json
    tsconfig.json
```

The mobile app and web dashboard both import from `@career-ops/shared`.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Expo SDK 52 + React Native 0.76 | Cross-platform runtime |
| **Language** | TypeScript (strict) | Same as web dashboard |
| **Navigation** | expo-router (file-based routing) | Same pattern as Next.js App Router |
| **UI Components** | react-native-paper + NativeWind | Material Design 3 + Tailwind-like styling |
| **State Management** | TanStack Query (React Query) | Server state, caching, pagination |
| **Auth** | Supabase Auth (email, Google, Apple) | Free tier, Drop-in UI components |
| **Push Notifications** | Expo Notifications + Firebase Cloud Messaging | Job alerts |
| **Offline First** | TanStack Query Persist + expo-sqlite | Browse cached jobs offline |
| **Background Fetch** | expo-background-fetch | Periodic job scan on device |
| **Deep Linking** | expo-linking + expo-router deep links | Open job links from notifications |
| **Maps** | expo-maps / react-native-maps | Job location map view |
| **CV/Resume View** | expo-file-system + expo-print | Download/open PDF resumes |
| **Build & Deploy** | EAS Build + EAS Submit | CI/CD to App Store + Play Store |
| **Analytics** | PostHog (free tier, self-hostable) | User behavior tracking |
| **Error Tracking** | Sentry (free tier) | Crash reporting |
| **Testing** | Jest + React Native Testing Library + Detox | Unit + E2E |

---

## Project Structure

```
mobile/
├── app/                        # Expo Router (file-based routing)
│   ├── _layout.tsx             # Root layout (auth provider, theme, query client)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                 # Bottom tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # Dashboard / Home tab
│   │   ├── jobs.tsx            # Job browser tab
│   │   ├── applications.tsx    # Application tracker tab
│   │   ├── profile.tsx         # User profile / settings tab
│   │   └── reports.tsx         # Evaluation reports tab
│   ├── job/[id].tsx            # Job detail screen
│   ├── application/[id].tsx    # Application detail screen
│   ├── evaluate.tsx            # New evaluation (paste JD / URL)
│   ├── settings.tsx            # App settings
│   ├── report/[num].tsx        # Full evaluation report
│   └── +not-found.tsx
│
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ScoreBadge.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── BottomSheet.tsx
│   │   ├── job/                # Job-specific components
│   │   │   ├── JobCard.tsx      # Job list item
│   │   │   ├── JobDetail.tsx    # Full job detail
│   │   │   ├── JobFilters.tsx   # Filter sheet
│   │   │   └── ApplyButton.tsx  # Apply CTA (opens browser)
│   │   ├── application/
│   │   │   ├── AppCard.tsx
│   │   │   ├── StatusTimeline.tsx
│   │   │   └── ScoreChart.tsx
│   │   ├── pipeline/
│   │   │   ├── PipelineCard.tsx
│   │   │   └── AddUrlModal.tsx
│   │   ├── evaluation/
│   │   │   ├── JdInput.tsx
│   │   │   └── EvalProgress.tsx
│   │   └── profile/
│   │       ├── ProfileCard.tsx
│   │       └── SkillTag.tsx
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useJobs.ts
│   │   ├── useApplications.ts
│   │   ├── usePipeline.ts
│   │   ├── useReports.ts
│   │   ├── useEvaluate.ts
│   │   └── usePushNotifications.ts
│   │
│   ├── api/                    # API client (shared types with web)
│   │   ├── client.ts           # Axios/fetch wrapper with auth
│   │   ├── jobs.ts             # Job API calls
│   │   ├── applications.ts
│   │   ├── pipeline.ts
│   │   ├── reports.ts
│   │   ├── evaluate.ts
│   │   ├── scan.ts
│   │   └── resumes.ts
│   │
│   ├── providers/              # React context providers
│   │   ├── AuthProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── QueryProvider.tsx
│   │   └── NotificationProvider.tsx
│   │
│   ├── utils/                  # Shared utilities
│   │   ├── format.ts           # Date, salary, score formatting
│   │   ├── validation.ts       # Form validation
│   │   ├── links.ts            # Deep linking helpers
│   │   └── storage.ts          # Secure storage (token, prefs)
│   │
│   └── constants/
│       ├── theme.ts            # Colors, spacing, typography
│       └── config.ts           # API URL, feature flags
│
├── assets/                     # Icons, splash screen, adaptive icon
│   ├── icons/
│   ├── splash.png
│   └── adaptive-icon.png
│
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
├── package.json
├── tsconfig.json
├── tailwind.config.js          # NativeWind config
└── babel.config.js
```

---

## Database Tables (New for Mobile)

Add to the existing PostgreSQL (prisma/schema.prisma):

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  avatarUrl     String?
  supabaseId    String   @unique
  scanTokens    Int      @default(0)     // Monthly scan quota
  premiumUntil  DateTime?                // Premium subscription
  settings      Json?                    // Notification prefs, filters
  createdAt     DateTime @default(now())
  lastSeenAt    DateTime?

  applications  Application[]
  savedJobs     SavedJob[]
  devices       UserDevice[]
}

model UserDevice {
  id         String   @id @default(cuid())
  userId     String
  pushToken  String
  platform   String   // ios, android
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

model SavedJob {
  id        String   @id @default(cuid())
  userId    String
  jobUrl    String
  title     String
  company   String
  notes     String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, jobUrl])
}
```

---

## API Endpoints (New for Mobile)

Add to the existing Next.js API routes:

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/supabase` | Exchange Supabase session for app session |
| `GET` | `/api/mobile/jobs/feed` | Infinite-scroll job feed (filtered + scored) |
| `GET` | `/api/mobile/jobs/:url/hash` | Short job detail by URL hash |
| `POST` | `/api/mobile/save-job` | Save/bookmark a job |
| `DELETE` | `/api/mobile/save-job/:id` | Unsave a job |
| `GET` | `/api/mobile/saved-jobs` | List saved jobs |
| `POST` | `/api/mobile/device/register` | Register push notification token |
| `POST` | `/api/mobile/evaluate` | Enqueue job evaluation, return job ID |
| `GET` | `/api/mobile/evaluate/:id/stream` | SSE stream evaluation progress |
| `GET` | `/api/mobile/stats` | Dashboard stats (summary, funnel) |
| `POST` | `/api/mobile/scan` | Trigger scan, return job IDs |
| `GET` | `/api/mobile/reports` | List recent reports (paginated) |
| `GET` | `/api/mobile/applications` | List applications with status |
| `PATCH` | `/api/mobile/applications/:id` | Update application status |

---

## Screens & User Flows

### 1. Auth Flow

```
App Launch
  ├── Not logged in → Login / Signup screen
  │     ├── Email + password (Supabase Auth)
  │     ├── Google OAuth
  │     ├── Apple OAuth
  │     └── Biometric (Face ID / fingerprint) on relogin
  └── Logged in → Dashboard
```

### 2. Dashboard (Home Tab)

```
┌─────────────────────────────┐
│  Good morning, Uday         │
│                              │
│  ┌──────┬──────┬──────┐    │
│  │  12  │  8   │  4   │    │
│  │ New  │Applied│ Saved│    │
│  └──────┴──────┴──────┘    │
│                              │
│  📋 Recent Applications      │
│  ┌────────────────────────┐ │
│  │ Sr. SRE @ Google       │ │
│  │ Status: Interview      │ │
│  │ Score: 4.5/5           │ │
│  ├────────────────────────┤ │
│  │ DevOps @ Netflix       │ │
│  │ Status: Applied        │ │
│  │ Score: 4.2/5           │ │
│  └────────────────────────┘ │
│                              │
│  🔥 Matched Jobs Today       │
│  ┌────────────────────────┐ │
│  │ Platform Eng @ Stripe  │ │
│  │ Remote • $180k-220k    │ │
│  ├────────────────────────┤ │
│  │ Cloud SRE @ Datadog    │ │
│  │ Hybrid NYC • $160-200k │ │
│  └────────────────────────┘ │
│                              │
│  [⚡ New Scan] [📥 Pipeline]│
└─────────────────────────────┘
```

### 3. Job Browser

```
┌─────────────────────────────┐
│  🔍 Jobs          [Filters] │
│                              │
│  ┌─── Tags ───────────────┐ │
│  │ SRE DevOps Cloud K8s  │ │
│  └────────────────────────┘ │
│                              │
│  ⚡ Quick Apply              │
│  ┌────────────────────────┐ │
│  │ Sr. Site Reliability   │ │
│  │ Google • Remote        │ │
│  │ Score: 4.5 ★★★★★      │ │
│  │ 💾 Saved    📄 Apply   │ │
│  ├────────────────────────┤ │
│  │ DevOps Engineer        │ │
│  │ Netflix • Los Angeles  │ │
│  │ Score: 4.2 ★★★★       │ │
│  │ 💾 Save     📄 Apply   │ │
│  └────────────────────────┘ │
│                              │
│  [Load more...]              │
└─────────────────────────────┘

→ Tap a job → Job Detail:
┌─────────────────────────────┐
│  ← Back             [💾]   │
│                              │
│  Sr. Site Reliability Eng   │
│  Google • Remote             │
│  Score: 4.5/5 ★★★★★        │
│                              │
│  ┌──────┬──────┬──────┐     │
│  │  AI  │Apply │ Share │     │
│  │ Eval │      │       │     │
│  └──────┴──────┴──────┘     │
│                              │
│  Match Analysis:             │
│  • Skills: 9/10             │
│  • Exp: 8/10                │
│  • Culture: 7/10            │
│                              │
│  Job Description             │
│  ┌────────────────────────┐ │
│  │ We're looking for a...  │ │
│  │ [View full JD]         │ │
│  └────────────────────────┘ │
│                              │
│  [📄 Generate Tailored CV]  │
│  [✉️ Generate Cover Letter] │
│  [🤝 Find Referral Contact] │
└─────────────────────────────┘
```

### 4. Application Tracker

```
┌─────────────────────────────┐
│  📋 Applications   [+ Add] │
│                              │
│  ┌── Status Filter ───────┐ │
│  │ All│Applied│Interview│ │ │
│  └────────────────────────┘ │
│                              │
│  ┌────────────────────────┐ │
│  │ Google • Sr. SRE       │ │
│  │ 🟢 Interview • Apr 15  │ │
│  │ Score: 4.5             │ │
│  ├────────────────────────┤ │
│  │ Netflix • DevOps       │ │
│  │ 🔵 Applied • Apr 10   │ │
│  │ Score: 4.2             │ │
│  ├────────────────────────┤ │
│  │ Stripe • Platform Eng  │ │
│  │ ⚪ Saved • Apr 8      │ │
│  │ Score: 4.0             │ │
│  └────────────────────────┘ │
└─────────────────────────────┘

→ Tap application → Detail:
┌─────────────────────────────┐
│  ← Back             [✏️]   │
│                              │
│  Sr. Site Reliability Eng   │
│  Google                      │
│                              │
│  Status: Interview           │
│  Score: 4.5 / 5             │
│                              │
│  ┌── Timeline ────────────┐ │
│  │ ✅ Evaluated  Apr 8    │ │
│  │ ✅ Applied    Apr 9    │ │
│  │ 🔄 Interview  Apr 15  │ │
│  │ ⏳ Offer              │ │
│  └────────────────────────┘ │
│                              │
│  [📄 View Report]            │
│  [📄 View CV]                │
│  [✉️ View Cover Letter]      │
│  [🗓️ Add Follow-up Reminder]│
└─────────────────────────────┘
```

### 5. Evaluation (New JD)

```
┌─────────────────────────────┐
│  ⚡ New Evaluation          │
│                              │
│  Paste job URL or JD text:  │
│  ┌────────────────────────┐ │
│  │ https://boards.green.. │ │
│  │                        │ │
│  │                        │ │
│  └────────────────────────┘ │
│                              │
│  [🔍 Evaluate]              │
│                              │
│  — OR —                      │
│                              │
│  [📷 Scan with Camera]      │
│  (OCR job posting from      │
│   screenshot)                │
└─────────────────────────────┘

→ After evaluate:
┌─────────────────────────────┐
│  ⚡ Evaluating...           │
│                              │
│  ┌────────────────────────┐ │
│  │ ████████████░░░░ 70%  │ │
│  │                        │ │
│  │ ✓ Fetching job detail  │ │
│  │ ✓ Analyzing match      │ │
│  │ ⟳ Scoring...          │ │
│  │ ⏳ Report generation   │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

### 6. Settings & Profile

```
┌─────────────────────────────┐
│  ⚙️ Settings                │
│                              │
│  Profile                     │
│  ┌────────────────────────┐ │
│  │ 👤 Uday Varmora        │ │
│  │    uday@example.com    │ │
│  │    [Edit Profile]      │ │
│  └────────────────────────┘ │
│                              │
│  Job Preferences             │
│  ┌────────────────────────┐ │
│  │ Roles: SRE, DevOps,   │ │
│  │ Cloud Engineer         │ │
│  │ Locations: Remote,     │ │
│  │ Bangalore, Pune        │ │
│  │ Salary: $120k+         │ │
│  │ [Edit Filters]         │ │
│  └────────────────────────┘ │
│                              │
│  Notifications               │
│  ┌────────────────────────┐ │
│  │ 🔔 New job matches    │ │
│  │ 🔔 Application updates │ │
│  │ 🔔 Interview reminders │ │
│  └────────────────────────┘ │
│                              │
│  Account                     │
│  ┌────────────────────────┐ │
│  │ 📊 Usage: 12/50 scans  │ │
│  │ 🌙 Dark mode           │ │
│  │ 🔒 Biometric lock      │ │
│  │ 🚪 Sign out            │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

---

## Push Notification Flows

```
🔔 New job matched your filters
   ┌─────────────────────────────┐
   │ 🔥 New Match: Platform Eng │
   │ Stripe • Remote • $180-220k│
   │ Score: 9.2/10              │
   │                             │
   │ [View] [Dismiss]           │
   └─────────────────────────────┘
   → Opens job detail screen

🔔 Application status changed
   ┌─────────────────────────────┐
   │ 📋 Google Sr. SRE →        │
   │ Status: Interview 🎉       │
   │                             │
   │ [View] [Dismiss]           │
   └─────────────────────────────┘
   → Opens application detail

🔔 Scan complete
   ┌─────────────────────────────┐
   │ ✅ Scan complete            │
   │ 12 new jobs found           │
   │ 3 matches your filters      │
   │                             │
   │ [View Results] [Dismiss]   │
   └─────────────────────────────┘
   → Opens job browser with new badge

🔔 Interview reminder
   ┌─────────────────────────────┐
   │ 🗓️ Interview Tomorrow      │
   │ Google Sr. SRE @ 2:00 PM   │
   │                             │
   │ [Prepare] [Dismiss]        │
   └─────────────────────────────┘
   → Opens interview prep screen
```

---

## Offline-First Architecture

```
[Online Mode]
  ┌─────────────┐     ┌─────────────┐
  │  TanStack    │────▶│  API Server │
  │  React Query │     │  (CareerOps)│
  └──────┬──────┘     └─────────────┘
         │
  ┌──────▼──────┐
  │  expo-sqlite │
  │  (Persister) │
  └─────────────┘

[Offline Mode]
  ┌─────────────┐
  │  expo-sqlite │◀──── Read cached data
  │  (Local DB)  │───── Queue mutations
  └─────────────┘
         │
         ▼
  ┌─────────────┐
  │  NetInfo     │──▶ Reconnect → flush queue
  └─────────────┘
```

Data that stays available offline:
- Cached job listings (last 200)
- Saved/bookmarked jobs
- Application tracker read-only
- Evaluation reports (last 20)
- Profile and settings

Mutations queued offline:
- Status updates → sync when online
- Save/unsave jobs
- Profile edits

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3) — scaffolded ✅ (see `mobile/`)

**Goal:** Auth + job browser + basic navigation working on both platforms.

> Scaffolded in `mobile/`. Run `cd mobile && npm install && npm run start`.
> Auth runs in dev-bypass until Supabase keys are set (see `mobile/README.md`).

```
Week 1:
  ✅ Set up Expo project with TypeScript
  ✅ Install key deps declared (expo-router, NativeWind, TanStack Query) — run npm install
  ✅ Shared types (mobile/src/types — mirror backend API shapes)
  ✅ Auth screens (login, signup, forgot password)
  ◻ Supabase Auth integration wired (email); Google/Apple OAuth TODO

Week 2:
  ✅ Bottom tab navigation (Dashboard, Jobs, Applications, Profile)
  ✅ Job browser screen (search + pull-to-refresh; infinite scroll TODO)
  ✅ Job card component
  ✅ Job detail screen
  ◻ Filter bottom sheet (title, location, salary) — basic search done, sheet TODO

Week 3:
  ✅ API client with auth headers
  ✅ Connect job browser to Career-Ops API (/api/jobs, /api/applications, /api/summary)
  ✅ Pull-to-refresh
  ✅ Loading states and error handling
  ✅ UI polish (dark mode base theme, NativeWind design system)
```

### Phase 2: Core Features (Weeks 4-6)

**Goal:** Full application tracker, evaluation flow, push notifications.

```
Week 4:
  □ Application tracker screen + list
  □ Application detail screen
  □ Status timeline component
  □ Score badge / chart components
  □ Status update actions (PATCH)

Week 5:
  □ Evaluation screen (paste JD/URL)
  □ SSE streaming for evaluation progress
  □ Evaluation report view
  □ Save/bookmark jobs
  □ Pipeline inbox view

Week 6:
  □ Push notification setup (Expo Notifications)
  □ Notification handler + deep linking
  □ Background fetch for new jobs
  □ Device token registration
  □ Notification preferences in settings
```

### Phase 3: Advanced (Weeks 7-9)

**Goal:** Offline support, resume/CV handling, referrals.

```
Week 7:
  □ expo-sqlite + TanStack Query Persist
  □ Offline caching strategy for jobs/applications
  □ Offline mutation queue
  □ NetInfo integration + connectivity banner
  □ Conflict resolution on reconnect

Week 8:
  □ Resume/CV viewer (expo-file-system + expo-print)
  □ Resume generation trigger
  □ Cover letter viewer
  □ App settings screen (theme, units, preferences)
  📸 OCR scanning (camera → JD text)

Week 9:
  □ Referral finder screen
  □ Outreach contact display
  □ Interview prep screen
  □ Follow-up reminders reminder scheduling
  □ Share job via native share sheet
```

### Phase 4: Polish & Release (Weeks 10-12)

**Goal:** Testing, app store submission, CI/CD.

```
Week 10:
  ◑ Unit/flow tests (Jest + RN Testing Library) — harness live, 3 flow specs in mobile/__tests__ (login, jobs browse, tracker filter)
  □ Component snapshot tests
  □ E2E tests (Detox) — deferred; needs native build + emulator
  □ Edge case handling (empty states, network errors, rate limits)
  □ Accessibility audit (screen reader, dynamic type)
  □ Performance profiling (FPS, memory, bundle size)

Week 11:
  □ App icon, splash screen, adaptive icons
  □ App Store screenshots (iPhone + Android)
  □ Privacy policy + terms of service
  □ EAS Build configuration
  □ App Store Connect setup (iOS)
  □ Google Play Console setup (Android)

Week 12:
  □ EAS Submit configuration
  □ TestFlight beta testing
  □ Google Play internal testing
  □ Bug fixes from beta feedback
  □ Production release (iOS App Store + Google Play)
  □ Post-release monitoring (Sentry, analytics)
```

---

## Key npm Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-notifications": "~0.29.0",
    "expo-background-fetch": "~0.13.0",
    "expo-sqlite": "~15.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-linking": "~7.0.0",
    "expo-file-system": "~18.0.0",
    "expo-print": "~14.0.0",
    "expo-camera": "~16.0.0",
    "expo-device": "~7.0.0",
    "expo-constants": "~17.0.0",
    "expo-splash-screen": "~0.29.0",
    "@react-navigation/native": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/query-async-storage-persister": "^5.0.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "react-native-paper": "^5.12.0",
    "react-native-vector-icons": "^10.0.0",
    "react-native-safe-area-context": "^5.0.0",
    "react-native-reanimated": "^3.16.0",
    "react-native-gesture-handler": "^2.21.0",
    "react-native-maps": "^1.18.0",
    "zustand": "^5.0.0",
    "zod": "^4.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "posthog-react-native": "^3.0.0",
    "@sentry/react-native": "^6.0.0",
    "axios": "^1.7.0",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "~18.3.0",
    "typescript": "~5.6.0",
    "jest": "^29.0.0",
    "@testing-library/react-native": "^12.0.0",
    "detox": "^20.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0"
  }
}
```

---

## Free Tier Services for Mobile

| Service | Free Tier | Purpose |
|---------|-----------|---------|
| **Supabase** | 500MB DB, 5GB bandwidth, 50K users | Auth + user profiles |
| **Expo** | Unlimited OTA updates, 30-day build logs | Build + deploy pipeline |
| **Expo Notifications** | Free push notifications | Job alerts |
| **PostHog** | 1M events/month, unlimited users | Analytics |
| **Sentry** | 5K errors/month | Crash reporting |
| **Apple Developer** | $99/year (required) | App Store submission |
| **Google Play** | $25 one-time | Play Store submission |

---

## Links & References

### Skills to Install for AI-Assisted Development

```bash
npx skills add mindrally/skills@expo-react-native-typescript
npx skills add pproenca/dot-skills@expo-react-native-performance
npx skills add dpearson2699/swift-ios-skills@swiftui-patterns
npx skills add dpearson2699/swift-ios-skills@push-notifications
npx skills add petrkindlmann/qa-skills@mobile-testing
npx skills add thebeardedbearsas/claude-craft@testing-reactnative
npx skills add aj-geddes/useful-ai-prompts@app-store-deployment
npx skills add alinaqi/claude-bootstrap@ui-mobile
```

### Documentation

- [Expo Docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [NativeWind](https://www.nativewind.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

---

## Success Metrics

| Metric | Target (Month 1) | Target (Month 3) |
|--------|------------------|------------------|
| App Store rating | 4.0+ | 4.5+ |
| Crash-free rate | 99.0% | 99.5%+ |
| Cold start time | <3s | <2s |
| Job browse TTI | <2s | <1.5s |
| Evaluation time | Same as web | Same as web |
| Push notification CTR | — | 25%+ |
| Retention (D7) | — | 30%+ |
| Screen reader support | — | All screens |
