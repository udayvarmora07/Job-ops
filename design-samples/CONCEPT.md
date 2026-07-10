# Jobops — "Meridian" Design Concept

> **Meridian** (n.) The highest point; the peak of achievement. A guiding line.

---

## The Problem with the Current UI

| Issue | Current State | Impact |
|-------|--------------|--------|
| Navigation overload | 9 tabs visible at once | Users don't know where to start |
| No emotional hook | Generic dark admin panel | Feels like a chore, not a tool |
| Data without meaning | Raw tables and lists | Hard to see progress or prioritise |
| Mobile is a web port | Same tabs, smaller screen | Doesn't use native mobile strengths |
| No "today" focus | Everything fights for attention | Decision fatigue on every visit |

---

## Who Are Our Users?

### Primary: The Selective Senior

- Senior engineer / PM / AI practitioner, 5–15 years experience
- Earns well, is picky — applies to 5 great roles, not 50 average ones
- Uses Linear, Notion, Superhuman daily — high bar for tool quality
- **Job search = a project to manage**, not a part-time hobby
- Pain: Keeping track of 20+ applications across 6 stages without losing signal

### Secondary: The Focused Career Changer

- 3–8 years experience, pivoting to a new domain (e.g. data → AI engineering)
- Needs coaching on fit — "is this role right for me?"
- Relies heavily on AI scoring and CV tailoring
- Pain: Doesn't know what to prioritise each day

### Tertiary: The Passive Watcher

- Employed, open to opportunities but not actively searching
- Checks in weekly, wants alerts not dashboards
- Pain: Too much friction to stay updated

---

## Design Philosophy: "Calm Intelligence"

> Your job search should feel like being briefed by a brilliant advisor —
> not managing a spreadsheet.

**Three pillars:**

1. **Today-first** — Every session starts with one clear answer to "what should I do now?"
2. **Signal over noise** — AI surfaces what matters. Everything else is accessible, not loud.
3. **Celebrate momentum** — Every score, every application, every interview is a visible win.

---

## Design System: "Precision Dark"

A hybrid of Swiss Modernism (grid, mathematical spacing, typographic hierarchy)
and Precision Dark (deep navy, not pure black — has personality and warmth).

### Colour Palette

| Role | Light Mode | Dark Mode | Usage |
|------|-----------|-----------|-------|
| Background | `#F8FAFF` | `#080C1A` | Page canvas |
| Surface | `#FFFFFF` | `#0F1629` | Cards, panels |
| Surface raised | `#F1F5FD` | `#161E36` | Nested cards |
| Border | `#E2E8F6` | `#1E2A45` | Dividers |
| Primary | `#4F46E5` | `#6366F1` | Brand, CTA |
| Accent / Energy | `#F59E0B` | `#FBBF24` | Scores, badges, wins |
| Success | `#059669` | `#10B981` | Applied, interview, offer |
| Danger | `#DC2626` | `#F87171` | Rejected, errors |
| Text primary | `#0F172A` | `#F1F5F9` | Headings, key data |
| Text secondary | `#475569` | `#94A3B8` | Body, labels |
| Text muted | `#94A3B8` | `#475569` | Hints, timestamps |

**Signature**: Score badges always use Amber — it's warm, aspirational, not alarming.

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
xs:  4px   sm:  8px   md:  16px
lg:  24px  xl:  32px  2xl: 48px  3xl: 64px
```

### Elevation (Dark Mode)
```
Level 0: #080C1A  — page bg
Level 1: #0F1629  — cards
Level 2: #161E36  — raised cards, dropdowns
Level 3: #1E2A45  — modals, popovers
```

---

## Web: Navigation Redesign

**Before**: 9 horizontal tabs crammed into a tab bar.
**After**: Collapsible left sidebar with 6 grouped items + a "Today" home.

```
SIDEBAR (collapsed = icons only, expanded = icon + label)
──────────────────────────────────────
  ⚡ Today          ← always first, "what to do now"
  ──────────────────
  🔍 Discover       ← job browser with AI filters
  📬 Pipeline       ← applications by stage (kanban feel)
  📊 Reports        ← evaluation reports
  ──────────────────
  👥 Referrals      ← connections + outreach
  ✉️  Outreach       ← posts + emails
  📄 Resumes        ← CV library
  ──────────────────
  ✨ AI Studio      ← (power users only, not always visible)
  ──────────────────
  [Avatar] Settings
```

**Why**: Sidebar scales to more items without visual chaos. Collapses to icons on smaller screens. Matches Linear / Notion / Vercel patterns users already know.

---

## Web: "Today" View

The landing page after login. Answers: "What should I do right now?"

```
┌─────────────────────────────────────────────────────────┐
│  Good morning, Uday.  It's Tuesday — 3 things need you. │
├──────────────────┬──────────────────────────────────────┤
│  YOUR MISSION    │  PIPELINE PULSE                       │
│  ─────────────── │  ─────────────────────────────────── │
│  Top priority:   │  ● 2 to evaluate   ● 1 interview prep │
│                  │  ● 3 applied       ● 0 offers         │
│  [AI card]       │                                       │
│  Stripe Sr. Eng  │  MOMENTUM                            │
│  4.7/5 ★ HOT    │  ████████░░  8 this week              │
│  [Evaluate →]   │  ▲ +3 from last week                  │
│                  │                                       │
│  NEXT ACTIONS    │  RECENT WINS                         │
│  ─────────────── │  ─────────────────────────────────── │
│  • Follow up     │  ✓ Vercel — Interview scheduled       │
│    Vercel (day 5)│  ✓ Linear — CV tailored (4.8/5)      │
│  • Prep Google   │  ✓ Stripe — Report complete           │
│    interview     │                                       │
└──────────────────┴──────────────────────────────────────┘
```

---

## Mobile: Navigation Redesign

**Before**: Mirror of web tabs (9 items in an overflow menu).
**After**: 4-item bottom nav built around mobile-native workflows.

```
BOTTOM TAB BAR (always 4 items)
┌──────┬──────────┬─────────┬──────┐
│ Today│ Discover │  Track  │  Me  │
│  ⚡  │    🔍    │   📬    │  👤  │
└──────┴──────────┴─────────┴──────┘
```

**Today** — Daily brief + one top job + quick stats
**Discover** — Swipeable job cards (Tinder for jobs UX)
**Track** — Pipeline list by stage, swipe to update status
**Me** — Profile, resumes, settings, AI Studio

---

## Mobile: "Discover" Pattern (Key Innovation)

Job cards users swipe through — each card shows:
- Company logo + name
- Role title (large)
- AI Score badge (amber number, prominent)
- 3 signal tags: remote · $140k · strong match
- Quick actions: Skip ← → Save

This transforms passive browsing into an active, engaging loop.
Each swipe takes < 2 seconds. Feels native, not like a web app.

---

## Mobile: "Today" Screen

```
┌──────────────────────────┐
│  Good morning, Uday ☀️   │
│  You have 2 hot leads    │
│                          │
│  ┌────────────────────┐  │
│  │  STRIPE            │  │
│  │  Sr. Eng — Remote  │  │
│  │  ★ 4.7 / 5        │  │
│  │  [Evaluate now]    │  │
│  └────────────────────┘  │
│                          │
│  PIPELINE TODAY          │
│  ──────────────────────  │
│  • Follow up: Vercel     │
│  • Prep: Google SWE      │
│                          │
│  LAST 7 DAYS             │
│  8 eval  3 apply  1 ivw  │
└──────────────────────────┘
```

---

## Key Interaction Patterns

### Score Badge
- Amber circle with large number — always visible, never hidden
- Colour shifts: <3.5 muted gray · 3.5–4.0 amber · 4.0+ bright amber + glow
- Tap to see score breakdown (slide-up sheet)

### Celebration Moments
- Marking "Interview" → subtle confetti burst (respects prefers-reduced-motion)
- First offer → full screen moment with share prompt
- Completing profile → progress ring fills with animation

### AI Inline (not a separate tab)
- Every job card has "Tailor CV" and "Evaluate" inline
- No need to navigate to "AI Studio" for routine tasks
- AI Studio = power mode for custom prompts only

### Follow-up Cadence Indicator
- Applications past their follow-up date get a subtle amber dot
- Tap → quick action sheet: "Send follow-up" or "Mark responded"

---

## File Map

```
design-samples/
  CONCEPT.md          ← this file (design brief)
  design-system/
    tokens.css        ← CSS custom properties
    MASTER.md         ← full design system spec
  web/
    dashboard.html    ← interactive web dashboard prototype
    job-card.html     ← job card component deep dive
  mobile/
    today.html        ← Today screen mockup
    discover.html     ← Discover (swipe cards) mockup
    track.html        ← Pipeline/Track screen mockup
```
