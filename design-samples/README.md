# Jobops — "Meridian" Design Research & Competitive Intelligence

> **Research conducted:** July 2026  
> **Perspective:** 15+ years UX/Product Design · 20+ years Startup Product Development  
> **Sources:** Reddit, Trustpilot, App Store reviews, Forbes/BLS 2025 data, Molfar.io 2025, ColorPsychology.org, TailwindThemeMaker research, Stan.Vision 2024

---

## Table of Contents

1. [Market Reality](#market-reality)
2. [Target Users](#target-users)
3. [Competitor Analysis](#competitor-analysis)
4. [Feature Gap Matrix](#feature-gap-matrix)
5. [User Pain Points](#user-pain-points-real-signals)
6. [Color Psychology](#color-psychology--science)
7. [Design Philosophy](#design-philosophy-calm-intelligence)
8. [Product Opportunities](#product-opportunities)
9. [Design System](#design-system-meridian)
10. [Files in This Folder](#files-in-this-folder)

---

## Market Reality

The 2025 job search landscape is broken at a systemic level:

| Metric | Data | Source |
|--------|------|--------|
| Applications needed per offer | **400–750** | Sprout research 2025 |
| Companies using AI to screen resumes | **83%** | Sprout research 2025 |
| Ghost job rate (fake/inactive postings) | **38% phantom gap** | Forbes / BLS June 2025 |
| Government sector ghost job rate | **60%** | Forbes 2025 |
| Job apps with dark UI patterns | **97% of popular EU apps** | Molfar.io 2025 |
| Job seekers experiencing burnout | **70%+** | Multiple Reddit threads |

**The core insight:** Every tool in this space optimizes for *more applications sent*, not *better outcomes per application*. Jobops is built around the opposite philosophy — quality over quantity. The UI/UX must communicate this clearly.

---

## Target Users

### Primary — The Selective Senior
- Senior engineer / PM / AI practitioner, 5–15 years experience
- Earns well, applies to 5 great roles — not 50 average ones
- Daily tools: Linear, Notion, Superhuman (high UX bar)
- **Job search = a project to manage**, not a part-time hobby
- Pain: Keeping track of 20+ applications across 6 stages without losing signal

### Secondary — The Focused Career Changer
- 3–8 years experience, pivoting domains (e.g. data → AI engineering)
- Relies heavily on AI scoring and CV tailoring for fit signals
- Pain: Doesn't know what to prioritise each day, risks applying to wrong roles

### Tertiary — The Passive Watcher
- Employed but open to opportunities, checks in weekly
- Wants alerts, not dashboards
- Pain: Too much friction to stay updated without feeling overwhelmed

---

## Competitor Analysis

### Teal HQ — 2M+ users, AI-first positioning
**What they do:** Resume builder + job tracker + Chrome extension + AI suggestions  
**Price:** $13/week (≈$56/month) for premium

| Gap | Severity |
|-----|----------|
| No auto-submission — everything is manual despite "AI" branding | 🔴 Critical |
| AI suggestions feel generic — "need a lot of manual revision to sound authentic" (Trustpilot) | 🟡 Major |
| Chrome extension dependency — mobile users are second-class | 🟡 Major |
| $13/week hits unemployed users hardest — high churn at paywall | 🟡 Major |
| No ghost job detection | 🟠 Minor |
| No emotional/momentum layer — feels like spreadsheet admin | 🟠 Minor |

**Reddit signal:** *"I paid for the upgrade and asked for a refund. All those influencers aren't in the job market — they haven't actually used Teal."* — r/linkedin

---

### Huntr — Kanban-style visual tracker
**What they do:** Trello-style job board + AI resume builder + contact management  
**Price:** $0 (40 job limit) / $40/month Pro (credits expire)

| Gap | Severity |
|-----|----------|
| Resume builder lock-in — cannot use existing CV with full features | 🔴 Critical |
| $40/month with non-rollover credits — subscription trap | 🔴 Critical |
| Customer support "black hole" — cancellation deliberately hard | 🔴 Critical |
| Free plan hits 40-job limit in days for active seekers | 🟡 Major |
| Resume templates rated below competitors | 🟡 Major |
| No AI job quality scoring or salary benchmarking | 🟡 Major |

**Trustpilot signal:** *"Customer Service isn't available to support you in real time. Tool only works if you've built a resume using their platform."* — Katie H.

---

### LinkedIn — 1B+ users, dominant but adversarial
**What they do:** Job discovery + professional network + premium insights  
**Price:** Free (limited) / $39+/month Premium

| Gap | Severity |
|-----|----------|
| 38% of listings are ghost jobs — massive trust destruction | 🔴 Critical |
| Dark patterns: fake urgency, hidden subscriptions, data harvesting | 🔴 Critical |
| Social feed fractures focused job search — high time-waste ratio | 🟡 Major |
| Premium gates basic insights (salary, who viewed) from unemployed users | 🟡 Major |
| No AI scoring — all jobs shown equal regardless of fit | 🟡 Major |
| No integrated tracking — "Easy Apply" has no pipeline view | 🟡 Major |

**Forbes/BLS 2025 data:** *"7.4M openings vs 5.2M actual hires — 38% phantom gap. 60% ghost rate in government sector."*

---

### Jobscan — ATS keyword optimizer
**What they do:** Resume vs JD keyword matching + ATS simulation  
**Price:** $49/month

| Gap | Severity |
|-----|----------|
| No application tracking — solves 1 of 10 problems for $49/month | 🔴 Critical |
| Optimizes for bots, not humans — ATS-perfect resumes still get rejected | 🔴 Critical |
| No job discovery, no scanning, no interview prep, no salary data | 🟡 Major |
| No mobile — desktop-only with multi-tab workflow | 🟡 Major |

**2025 teardown finding:** *"Jobscan: When Optimization Misses the Real Goal"* — optimizing for ATS bots can make resumes robotic enough that humans reject them. Wrong feedback loop.

---

### Otta / Welcome to
**What they do:** Curated tech job discovery with salary transparency  
**Price:** Free

| Gap | Severity |
|-----|----------|
| No application tracking — zero retention after discovery | 🔴 Critical |
| Sparse job volume vs LinkedIn/Indeed | 🔴 Critical |
| No AI scoring, no CV tailoring, no interview prep | 🟡 Major |
| No mobile app | 🟡 Major |

---

### Simplify — Auto-fill extension
**What they do:** One-click job application autofill + basic tracking  
**Price:** Free

| Gap | Severity |
|-----|----------|
| No AI job evaluation — quantity over quality at exactly the wrong moment in history | 🔴 Critical |
| Shallow tracking only — no stage management, no patterns, no reports | 🔴 Critical |
| No CV tailoring — same resume everywhere | 🟡 Major |
| No interview prep or post-apply support | 🟡 Major |
| Browser extension only — no standalone product | 🟡 Major |

---

## Feature Gap Matrix

| Feature | **Jobops** | Teal HQ | Huntr | LinkedIn | Jobscan | Simplify |
|---------|-----------|---------|-------|----------|---------|---------|
| AI job evaluation / scoring | ✅ Best | ⚠️ Basic | ⚠️ Match % | ❌ | ⚠️ ATS only | ❌ |
| CV tailoring per job | ✅ Full AI | ⚠️ Manual | ⚠️ Manual | ❌ | ⚠️ Keywords | ❌ |
| Bring your own CV | ✅ | ✅ | ❌ Lock-in | ❌ | ✅ | ✅ |
| Ghost job detection | ✅ Playwright | ❌ | ❌ | ❌ | ❌ | ❌ |
| Rejection pattern analysis | ⚠️ Partial | ❌ | ❌ | ❌ | ❌ | ❌ |
| Interview prep (AI) | ✅ | ⚠️ Basic | ❌ | ⚠️ Premium | ❌ | ❌ |
| Network / referral tracking | ✅ AI-scored | ❌ | ⚠️ Contacts | ✅ | ❌ | ❌ |
| Portal auto-scanning | ✅ 45+ portals | ⚠️ 50 boards | ❌ | ✅ | ❌ | ❌ |
| Follow-up cadence AI | ✅ | ⚠️ Manual | ⚠️ Manual | ❌ | ❌ | ❌ |
| Salary negotiation scripts | ✅ | ❌ | ❌ | ⚠️ Premium | ❌ | ❌ |
| Mobile app (native) | ⚠️ In progress | ❌ | ❌ | ✅ | ❌ | ❌ |
| Offline / PWA | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Free / bring-your-own AI key | ✅ OSS | ❌ $13/wk | ❌ $40/mo | ❌ $39/mo | ❌ $49/mo | ✅ Free |
| Cover letter generation | ✅ | ✅ | ✅ | ⚠️ Helper | ❌ | ❌ |
| Deep company research | ✅ | ❌ | ❌ | ⚠️ Manual | ❌ | ❌ |
| Emotional momentum / wins | ⚠️ Partial | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-language modes | ✅ EN/DE/FR/JA | ❌ | ❌ | ✅ | ❌ | ❌ |
| Open source / self-host | ✅ **Unique** | ❌ | ❌ | ❌ | ❌ | ❌ |

> **✅ Full** · **⚠️ Partial** · **❌ Missing**

---

## User Pain Points — Real Signals

Aggregated from Reddit (r/jobsearchhacks, r/recruitinghell, r/cscareerquestions), Trustpilot, and review sites:

### #1 — Ghost Job Waste (Critical)
No tool actively filters fake postings before users invest hours applying. Jobops already verifies with Playwright — this needs to be a *visible* badge in the UI, not a hidden backend check.

### #2 — Rejection Blindness (Critical)
Users submit hundreds of applications with zero feedback on *why* they're failing. No pattern analysis. No "you're being ATS-filtered — here's why." This is the most commonly requested missing feature across all platforms.

### #3 — Vendor Lock-in (Major)
Huntr forces you to rebuild your CV inside their system. Teal's premium features require Chrome extension. Users hate being trapped. "Bring your own everything" is a genuine differentiator.

### #4 — No Emotional Intelligence (Major)
Job search burnout is documented across thousands of Reddit posts. No tool acknowledges the emotional dimension. No wins celebration, no streak tracking, no "you've had 3 rejections — time to restrategize?" check-in. The tool that helps users feel good about their search is the one they recommend to friends.

### #5 — Mobile is an Afterthought (Major)
All major tools are web-only or have web-ported mobile experiences. LinkedIn's mobile app is ad-heavy and social-first, not job-management-first. There is no high-quality native job management app for senior tech professionals. This is a blue ocean.

---

## Color Psychology — Science

### Deep Navy (#080C1A) — Foundation
Not pure black. Research shows pure #000000 causes *halation* — bright text on pure black creates a halo effect that causes eye fatigue faster in extended sessions (8+ hours). Deep navy eliminates halation while maintaining visual drama.

**Psychology:** Authority, stability, depth, professionalism, trustworthiness.  
**Precedent:** Linear, Vercel dashboard, Stripe — tools your users already trust daily.  
**Why not pure black:** Pure black makes bright elements "float" unnaturally; navy grounds them.

### Indigo (#6366F1) — Primary Action
2024–2025 trend: purple/indigo is dominating premium SaaS design (Stan.Vision 2024 research — documented across major design publications). Not a coincidence.

**Psychology:** Bridges blue (trust, reliability) and violet (creativity, imagination). For AI-powered tools, signals *intelligent creativity* — not cold corporate blue, not playful startup green.  
**Research quote (TailwindThemeMaker):** "If you're building a cutting-edge AI startup or design-first SaaS tool (like Linear or Stripe), indigo evokes a premium, sophisticated aesthetic that sets you apart from corporate competitors."  
**Why not blue:** Blue is generic enterprise. Indigo is AI-era innovation.  
**Why not purple:** Purple reads as quirky/consumer. Indigo reads as precision/premium.

### Amber (#FBBF24) — Scores & Achievement
The most important and most non-obvious color decision in the system.

**The mistake most tools make:** Green = good, Red = bad for scores. This creates anxiety. Users avoid opening dashboards because they fear seeing red. Red triggers avoidance behavior — which is churn.

**Amber psychology (ColorPsychology.org research):** "Amber stimulates the mind and promotes feelings of well-being and contentment. Its golden tones are often linked with the warmth of the sun, creating a sense of happiness and hope."

**Why amber for scores:**
- A 4.7/5 in amber reads: *"You earned this, and it feels great."*
- The same number in green reads: *"Pass/fail grading."*
- Amber is aspirational, not binary. It keeps users engaged vs anxious.
- Golden associations activate the brain's reward system — users feel pride seeing their score, not test anxiety.

### Emerald (#10B981) — Progress & Success
Used sparingly — only for truly positive states (Interview scheduled, Offer received, Applied).

**Psychology:** Growth, harmony, forward momentum, safe completion.  
**Why emerald not lime:** Emerald at this saturation reads premium. Lime green reads cheap.  
**Rule:** Overuse kills meaning. If everything is green, nothing is green.

### What NOT To Do

| Mistake | Why It's Wrong |
|---------|---------------|
| Pure black (#000) background | Halation, eye fatigue, elements "float" |
| Red for low scores | Triggers anxiety → avoidance → churn |
| More than 3 semantic accent colors | Dilutes meaning, creates cognitive load |
| Lime green instead of emerald | Reads cheap/consumer, not premium |
| Gray text on gray background | Fails WCAG AA (4.5:1 contrast requirement) |

---

## Design Philosophy: "Calm Intelligence"

> Your job search should feel like being briefed by a brilliant advisor — not managing a spreadsheet.

**Three pillars:**

1. **Today-first** — Every session starts with one clear answer to "what should I do right now?" Not a dashboard of equal-weight tabs. One hero action.

2. **Signal over noise** — AI surfaces what matters. The score badge, the "HOT LEAD" tag, the follow-up overdue indicator — everything else is accessible but not loud.

3. **Celebrate momentum** — Every score, every application, every interview is a visible win. Job search is emotionally brutal. The tool must counteract that actively.

**Navigation philosophy:**  
- Web: Left sidebar (collapsible) replaces 9-tab design. Scales without chaos. Matches Linear/Notion/Vercel — what your users already know.  
- Mobile: 4-item bottom nav (Today · Discover · Track · Me). Each tab owns a native mobile workflow. No overflow menus.

---

## Product Opportunities

Ranked by impact × effort × competitive differentiation:

### 1. Ghost Job Shield (High Impact · Low Effort · Unique)
Jobops already verifies postings with Playwright. Surface this as a visible "Verified Active" / "Suspicious" / "Likely Closed" badge on every job card. No competitor does this. Removes the #1 source of job search frustration at near-zero additional engineering cost.

### 2. Rejection Intelligence Dashboard (High Impact · Medium Effort · Unique Moat)
Pattern analysis across a user's own application history: "Your applications to Series A startups have 0% response rate vs 40% at Series B." "Your resume is getting ATS-filtered on these 3 keywords across 12 applications." The data already exists inside Jobops. No competitor has the longitudinal data to build this.

### 3. Emotional Momentum System (High Impact · Low Effort · Zero Competition)
- Micro-confetti when "Interview" status is set
- Streak counter: "5 evaluations this week — on a roll!"
- Gentle restrategize prompt after 3 rejections in a row
- "Recent Wins" section visible on every session start

This is not UX polish — it's a retention multiplier. The tool that makes people feel good is the one they recommend to every friend.

### 4. Salary Intelligence Integration (High Impact · Medium Effort)
Embed real-time comp data into evaluation reports: "This role's $150k is 18% below your market rate. Here's the negotiation script." Otta shows salary transparency but has no tracking. Jobscan has no salary data. LinkedIn locks it behind premium. First tool to integrate this into the evaluation flow wins.

### 5. Native Mobile — Category Creation (High Impact · High Effort · Blue Ocean)
There is no high-quality native mobile job management app for senior tech professionals. LinkedIn's mobile is ad-heavy. Teal/Huntr/Jobscan have no mobile apps. The Discover swipe-card pattern (see `mobile/discover.html`) + Today screen = genuine category creation opportunity. First mover advantage is available right now.

### 6. Open Source as Trust Product (High Impact · Low Effort · Permanent Moat)
97% of job apps contain dark patterns (Molfar.io 2025). Users are increasingly paranoid — correctly — about data harvesting. Jobops is open source + bring-your-own API key + self-hostable. No funded competitor can ever make this claim. A visible "Privacy First" badge in the UI actively converts the high-value paranoid-but-smart senior user who generates the most referrals.

---

## Design System: "Meridian"

**Name meaning:** The highest point; the peak of achievement. A guiding line.

### Color Palette

| Role | Light Mode | Dark Mode | Psychological Function |
|------|-----------|-----------|----------------------|
| Background | `#F8FAFF` | `#080C1A` | Canvas — stability, authority |
| Surface | `#FFFFFF` | `#0F1629` | Cards — clarity, focus |
| Surface raised | `#F1F5FD` | `#161E36` | Depth hierarchy |
| Border | `#E2E8F6` | `#1E2A45` | Structure without noise |
| Primary (Indigo) | `#4F46E5` | `#6366F1` | Action — innovation, premium AI |
| Accent (Amber) | `#F59E0B` | `#FBBF24` | Scores — achievement, hope |
| Success (Emerald) | `#059669` | `#10B981` | Progress — growth, completion |
| Danger | `#DC2626` | `#F87171` | Errors only — not low scores |
| Text primary | `#0F172A` | `#F1F5F9` | Headings, key data |
| Text secondary | `#475569` | `#94A3B8` | Body, labels |
| Text muted | `#94A3B8` | `#475569` | Hints, timestamps |

### Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display / Hero | Outfit | 700 | 32–48px |
| Section heading | Outfit | 600 | 20–24px |
| Card title | Outfit | 500 | 16–18px |
| Body | Inter | 400 | 14–16px |
| Data / Numbers | JetBrains Mono | 500 | 13–16px |
| Labels / Caps | Inter | 600 | 11px, tracked |

### Spacing (8pt grid)
```
xs: 4px  sm: 8px  md: 16px  lg: 24px  xl: 32px  2xl: 48px  3xl: 64px
```

### Component Design Decisions

**Score Badge** — Always amber, always visible, never hidden. Colour shifts by value:
- `< 3.5` → muted gray (not red — avoids anxiety)
- `3.5–4.0` → amber (standard)
- `4.0+` → bright amber + subtle glow (aspirational)

**Status Pills** — Semantic colour per stage:
- Evaluated → Indigo
- Applied → Blue
- Interview → Emerald
- Offer → Amber
- Rejected → Muted gray (not red — same anxiety logic)
- SKIP → Gray

**Navigation Active State** — Left border accent (3px indigo) + background dim. Not just colour change. Gives spatial permanence — user always knows where they are.

---

## Files in This Folder

```
design-samples/
├── README.md                    ← This file — full research brief
├── CONCEPT.md                   ← Design concept summary (original notes)
│
├── design-system/
│   └── tokens.css               ← All CSS custom properties (colors, spacing, etc.)
│
├── web/
│   └── dashboard.html           ← Interactive web dashboard prototype
│                                   (Today / Discover / Pipeline — working navigation)
│
└── mobile/
    ├── today.html               ← Mobile Today screen (phone shell mockup)
    └── discover.html            ← Mobile Discover screen (draggable swipe cards)
```

### How to view prototypes

Serve the folder with any static server:
```bash
npx serve -p 5173 design-samples
# Then open:
# http://localhost:5173/web/dashboard.html
# http://localhost:5173/mobile/today.html
# http://localhost:5173/mobile/discover.html
```

Or open the HTML files directly in any browser — no build step required.

---

## Key Principles — TL;DR

1. **Navy not black.** Depth without harshness. Matches tools users already trust.
2. **Indigo not blue.** Premium AI aesthetic. Not generic enterprise.
3. **Amber not green for scores.** Achievement, not pass/fail. Keeps users engaged.
4. **Today-first layout.** Sidebar + hero action + 4-tab mobile. Kill the 9-tab chaos.
5. **Ghost job shield.** You have Playwright. Surface it. Category-defining feature.
6. **Celebrate wins.** Job search is brutal. The tool that helps users feel good wins.
7. **OSS = trust moat.** 97% of competitors have dark patterns. You don't. Say it louder.
8. **Mobile is blue ocean.** No good native job management app exists for senior tech users. Go build it.

---

*Research compiled July 2026 · Sources: Reddit, Trustpilot, Forbes/BLS 2025, Molfar.io 2025, Sprout 2025, ColorPsychology.org, TailwindThemeMaker, Stan.Vision 2024*
