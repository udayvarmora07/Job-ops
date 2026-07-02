# Cold Outreach Engine — Implementation Plan

> **Status:** Core pipeline WORKING end-to-end: find → verify → compose → **Gmail draft**
> (`lib-outreach/` + `outreach.mjs` + `lib-ai/tasks/cold-email.mjs` + Gmail MCP `create_draft`).
> Drafts are agent-created and NEVER auto-sent; the user attaches the résumé + sends.
> **Tracking store DONE** (`data/outreach.json` via `lib-outreach/store.mjs`): log →
> list → update status → auto follow-up date → `followups` due list.
> **Web "Outreach" tab DONE**: `web/components/dashboard/Outreach.tsx` + API routes
> `/api/outreach` (GET/POST/PATCH), `/api/outreach/find-email`, `/api/outreach/compose`.
> Find → verify → compose → "Track this outreach" + a tracked table with status edit +
> follow-up-due badges. Verified live (tsc clean; routes return real verified candidates).
> Only the CLI `outreach` skill mode remains (optional) — see §11.
>
> **NEW — Hiring-post source layer (LinkedIn "send your CV to …" posts):** a second
> front door to the engine. Recruiter hiring posts already carry the apply email (often
> in the first comment), so instead of *discovering* an address we *extract* it.
> Pieces: `lib-outreach/scan-posts.mjs` (Apify `harvestapi/linkedin-post-search`,
> comment-email extraction, dedup via `data/post-scan-history.tsv`),
> `lib-ai/tasks/parse-hiring-post.mjs` (`parse_hiring_post` → role/requirements/email JSON),
> a **5-template cold-mail library** with even A/B rotation + per-template reply-rate
> stats (`lib-outreach/templates.mjs`, research in [`COLD_MAIL_TEMPLATES.md`](COLD_MAIL_TEMPLATES.md)),
> web routes `/api/outreach/{scan-posts,parse-post,from-post}`, and a "Hiring posts →
> cold mail" sub-view in the Outreach tab. Résumé reuses `/api/generate-cv-pdf`. Draft-only,
> never sends. Manual paste is the always-works fallback when Apify finds nothing.
>
> **Built so far (2026-06-24):** `lib-outreach/` — multi-source email discovery
> (Hunter domain-search + email-finder, Prospeo enrich-person, Snov async finder,
> pattern inference, permutations) + layered verification (syntax → MX → Hunter
> primary, **Bouncer** deep [200 free credits], ZeroBounce last resort [5 credits])
> + ranking with a "valid-only" draft gate + the **cold-email composer**
> (`cold_email` task — jd_specific + speculative, real-metrics-only, ≤5 sentences).
> Test CLI: `node outreach.mjs <find|verify|pattern|compose|credits|keys>`.
> Verified live: discovery (`brian.chesky@airbnb.com` → 100% valid) + a clean
> Razorpay cold email using only real anchor metrics.
> **Goal:** For any company/JD in the pipeline, find the right decision-maker's
> email (HR / TA / hiring manager / CTO / CEO), draft a cold email tailored to
> that JD with Uday's matching résumé attached, and — when there is **no open
> role** — draft a *speculative* "are you hiring for DevOps/SRE?" email instead.
> Always stop at a reviewable draft. The user sends.
>
> **Source research:** [`email-finding-guide.md`](email-finding-guide.md) (10 sections, free-tier methods).
> **Builds on what already exists** — see §2.

---

## 1. What the user asked for (restated)

1. Find the email of a company's **HR / talent acquisition / hiring manager**, or a
   high-level decision-maker (**CEO / CTO / VP Eng**) for DevOps-type roles.
2. Send a **cold email for a specific job (JD)** with the **tailored résumé** for that JD attached.
3. If there is **no opening**, send a **speculative outreach**: "do you have any openings for these roles, or might you?"
4. Track the outreach so we follow up and never double-send.

This is a *cold-email* layer that sits next to the existing *LinkedIn referral* layer.

---

## 2. What already exists (reuse, don't rebuild)

| Capability | Where | Reuse for outreach |
|------------|-------|--------------------|
| Persona ranking (peer / manager / recruiter / alumni) + score | `web/lib/suggest.ts` | Decide **who** to email and **which ask** (referral vs insight vs "is hiring") |
| Real LinkedIn profile lookup (off-account, Apify) | `web/app/api/referrals/find-people/route.ts` | Get **names + titles** of HR/managers → feed into email discovery |
| AI message drafting (LinkedIn + email subject/body) | `web/lib/suggest.ts` `buildDrafts()`, `lib-ai/tasks/draft-referral.mjs` | Starting point for the cold-email composer |
| Referral tracking store | `data/referrals.json` (+ `/api/referrals`) | Extend the record shape with email fields, or add a sibling `outreach.json` |
| Tailored résumé PDF for a JD | `POST /api/generate-cv-pdf` → `output/resumes/...pdf` | The **attachment**. Already versioned per company+role |
| Multi-provider AI engine | `lib-ai/` (DeepSeek primary, NIM fallback) | New `cold_email` task |
| Profile (name, city, stack, proof metric, school, past company) | `config/profile.yml` via `web/lib/profile.ts` | Personalisation + warm-path filters |
| Gmail MCP (drafts, search, labels) | connected MCP server (`create_draft`, `search_threads`, …) | **Create the draft + attach résumé**, and check if we already emailed this domain |

**Key insight:** ~70% of this feature is *email discovery + verification + a cold-email
composer + a Gmail-draft step*. The "who to contact" brain already exists.

---

## 3. Architecture

```
            ┌─────────────────────────────────────────────────────────┐
            │  Job / company (from Jobs tab, pipeline, or manual entry) │
            └───────────────┬─────────────────────────────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  1. Identify decision-maker     │  reuse suggest.ts + find-people (Apify)
            │     name + title + LinkedIn     │  → {name, title, persona, linkedinUrl}
            └───────────────┬─────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  2. Email Discovery Engine      │  NEW: lib-outreach/
            │     domain → pattern → candidate│  layered, free-first (see §4)
            │     emails (ranked)             │
            └───────────────┬─────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  3. Verification                │  NEW: MX + syntax + (opt) SMTP/verifier API
            │     valid / risky / catch-all   │  (see §5)
            └───────────────┬─────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  4. Opening check               │  reuse check-liveness.mjs / scan data
            │     opening exists? yes/no      │  → picks email mode (JD vs speculative)
            └───────────────┬─────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  5. Cold-email composer (AI)    │  NEW: lib-ai/tasks/cold-email.mjs
            │     subject + <5-sentence body  │  two modes: jd_specific | speculative
            └───────────────┬─────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  6. Attach résumé + create      │  Gmail MCP create_draft
            │     Gmail DRAFT (never send)    │  attach output/resumes/*.pdf
            └───────────────┬─────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  7. Track in outreach store     │  NEW fields in referrals.json/outreach.json
            │     + follow-up cadence         │  reuse followup-cadence.mjs
            └─────────────────────────────────┘
```

New code lives in a new `lib-outreach/` module + a few `web/app/api/outreach/*` routes +
one new `lib-ai` task. No changes to the upstream career-ops system layer.

---

## 4. Email Discovery Engine (the core new piece)

A layered, **free-first, cheapest-and-safest-first** cascade. Stop as soon as one
high-confidence email is found; otherwise collect ranked candidates for the user.

**India reality check (important for Uday):** Kaspr/Lusha skew European; Hunter/Apollo
India coverage is patchy for small/mid Indian companies. So the **workhorse for the
India market is pattern inference + verification + GitHub/website scraping**, with
finder APIs as a bonus. Plan accordingly — don't over-index on a single SaaS finder.

### Layer 0 — Pattern inference (free, no API, highest leverage)
- Input: one *confirmed* email at the domain (from website / press / GitHub / a prior
  referral note), OR a known company pattern.
- Generate permutations for the target name with the **email-permutator** approach
  (guide §4.1–4.3): `first.last@`, `flast@`, `first@`, `firstlast@`, etc., ranked by
  the documented likelihood table.
- Pure Node — no dependency, no cost. This is the default path.

### Layer 1 — Free finder APIs (optional, key-gated, cheap)
See [§12.5 API shopping list](#125-api-shopping-list-corrected-against-2026-reality) for
the **verified, get-a-key-for-these** list (the guide's numbers are optimistic/outdated —
notably **Apollo's free plan has NO API access**, so it's not usable in the engine).
Each provider is a thin adapter behind one interface
`findEmail({name, domain}) → {email, confidence, source}`. Degrade gracefully: missing
key → skip that source. Keys are pooled and rotated (§12.6) so multiple accounts stack.

### Layer 2 — Scraper sources (Apify / Node, free-ish)
- **Company website extractor** — fetch About/Team/Contact/Careers, regex `mailto:` +
  `[\w.+-]+@domain`, decode Cloudflare-obfuscated emails (guide §3.2, §6.2). One
  confirmed email here unlocks Layer 0 for everyone.
- **GitHub commit emails** (Apify `saswave/github-emails-from-commits`, guide §3.5) —
  gold for **tech companies / CTOs / eng managers**, very relevant to DevOps targets.
- **YC directory scraper** (Apify `fatihtahta/y-combinator-directory-scraper`, guide
  §5.3) — pre-verified founder emails for YC startups (Uday already scans YC via
  `uday-data/scan-yc.mjs`).

### Layer 3 — Manual-assist (always available, zero cost)
When automation can't confirm, **hand the user ready-to-click tools** (this is what
`suggest.ts` already does for LinkedIn — extend it for email):
- Google X-ray links: `site:company.com "@company.com"`, `filetype:pdf "@company.com"`,
  press-release / contact-page operators (guide §3.1 table).
- The ranked permutation list + a one-click **Gmail people-chip verification** hint
  (guide §4.4 — paste into Gmail To: field, hover for profile card).
- LinkedIn People-tab deep link filtered to HR / TA / hiring titles (guide §2.2, §9.1).

**Output of the engine:** ranked `EmailCandidate[]` —
`{ email, name, title, persona, source, pattern, confidence: 0–1, verification }`.

---

## 5. Verification (protect Uday's sender reputation)

Bounce rate >2% can get a Gmail account throttled/blacklisted (guide §7). So verify
before drafting:

1. **Syntax** — RFC-ish regex (free, instant).
2. **MX lookup** — Node `dns.promises.resolveMx(domain)`. No MX → discard (guide §6.4).
3. **Disposable / role-based flagging** — flag `info@ / hr@ / careers@` as role-based
   (lower priority but acceptable fallback with name in subject line; guide §7.4).
4. **(Optional) Deep verify** — stack free verifier APIs (NeverBounce 1k, MillionVerifier
   500, Bouncer 100, ZeroBounce 100; guide §7.1) behind one adapter. **Catch-all
   detection** matters: catch-all domains return "valid" for anything, so mark them
   `risky` not `valid` (guide §6.5).
5. **Raw SMTP probe** — supported but **off by default**: running it from a residential/
   Gmail IP risks blocks and false negatives (guide §6.3). Leave as an opt-in advanced flag.

Verification status drives UI: `valid` (green, draft freely), `risky/catch-all` (amber,
warn + suggest role-based fallback), `invalid` (red, don't draft).

---

## 6. Opening check → which email mode

Before composing, decide JD-specific vs speculative:
- If the outreach started from a **live JD** (Jobs tab / pipeline) → `jd_specific`.
  Optionally re-confirm liveness with existing `check-liveness.mjs` / `liveness-core.mjs`.
- If the user picked a **company with no current opening** (or liveness says closed) →
  `speculative`: ask whether they're hiring / will be hiring for DevOps/SRE/Platform/Cloud.

---

## 7. Cold-email composer — new AI task `cold_email`

`lib-ai/tasks/cold-email.mjs` → `buildColdEmail({ company, role, mode, person, jd? })`.
Pulls from `01_MASTER_BRIEF.md` (anchor metrics — never invent), `config/profile.yml`,
`article-digest.md`. Two prompt modes:

**`jd_specific`** (guide §10.4 best practices — under 5 sentences, one CTA):
- Subject: `DevOps Engineer application — Uday Varmora` (or role-matched).
- Body: 1-line who-I-am + 1–2 anchor metrics relevant to the JD + why this company +
  CTA ("open to a quick 15-min chat?" / "résumé attached for the {role} role").

**`speculative`** (no opening):
- Subject: `Exploring DevOps/SRE opportunities at {company}`.
- Body: brief intro + the ask: *"Do you have any current or upcoming openings for
  DevOps / SRE / Platform / Cloud roles? Résumé attached in case it's useful."*

Per-persona tone (reuse the persona logic): recruiter = process-oriented; manager =
team-fit + proof; CEO/CTO at <20-person startups = compelling value prop (guide §10.2 tiers).
Output JSON `{ subject, body, tone, attachmentRole }` so the API can wire the draft.

---

## 8. Send path — Gmail draft, never auto-send

**Ethical rule (CLAUDE.md / AGENTS.md): never submit/send without user review.** So the
pipeline ends at a **Gmail draft**, not a send:
- Use Gmail MCP `create_draft` with `to`, `subject`, `body`, and the tailored résumé
  PDF (`output/resumes/Uday_Varmora_{SUFFIX}_Resume.pdf`) as attachment.
- Before drafting, `search_threads` on the domain/person to avoid emailing someone we
  already contacted (dedup + politeness).
- The user opens Gmail, reviews, edits, and clicks **Send** themselves.
- Alternative (out of scope for v1): SMTP send via Nodemailer — rejected for v1 because
  it bypasses review and needs SPF/DKIM/DMARC setup (guide §10.4) and burns reputation risk.

---

## 9. Tracking & follow-up

Extend the referral record (or add `data/outreach.json` sibling) with:
```
emailUsed, emailSource, emailPattern, verification,
openingExists (bool), mode (jd_specific|speculative),
draftId (Gmail), sentDate, followUpDate, resumeFile
```
Reuse `followup-cadence.mjs` for nudge timing. Surface in the Referrals/Outreach tab and
respect the "one follow-up then move on" etiquette (guide §10.4).

---

## 10. Surfaces (UI + CLI)

**Web** — extend `JobDetailDialog.tsx` "Best Referral Paths" with an **"Email outreach"**
sub-panel (preferred over a whole new tab for v1):
- "Find email" button → shows ranked candidates + confidence + verification badges.
- "Draft cold email" (auto-picks JD vs speculative) → editable subject/body.
- "Attach résumé & create Gmail draft" → calls Gmail MCP, shows draft link.
- Manual-assist accordion: Google X-ray links, permutation list, LinkedIn People-tab link.

**CLI** — new mode `outreach` (alias `coldmail`): `modes/outreach.md`, registered in the
career-ops skill subcommands. Same engine, terminal flow, ends by writing a draft + a
copy-paste email block.

**API routes** (`web/app/api/outreach/`):
- `POST /find-email` `{ company, domain?, name?, title?, persona? }` → ranked candidates.
- `POST /verify-email` `{ email }` → `{ status, mx, catchAll, roleBased }`.
- `POST /compose` `{ company, role, mode, person, jd? }` → `{ subject, body }`.
- `POST /draft` `{ to, subject, body, resumeFile }` → Gmail draft id (via MCP bridge).

---

## 11. Phasing

| Phase | Scope | Cost / risk | Deliverable |
|-------|-------|-------------|-------------|
| **P1 — MVP** | Layer 0 pattern inference + Layer 3 manual-assist links + `cold_email` composer (both modes) + Gmail draft + tracking | $0, no new keys | End-to-end "find-ish → draft → Gmail draft" with manual email confirmation |
| **P2 — Verified discovery** | Layer 1 finder APIs (Hunter/Apollo/Prospeo) + §5 verification (MX + verifier APIs + catch-all) | free tiers, optional keys | Auto-found, auto-verified emails with confidence badges |
| **P3 — Scrapers + scale** | Layer 2 (website extractor, GitHub emails, YC scraper) + batch outreach across a shortlist + follow-up automation | Apify pay-per-use (~$0.001/result) | Bulk, high-coverage outreach lists |

P1 is genuinely useful alone and ships with zero new dependencies or keys.

---

## 12. Risks, ethics & compliance (read before building)

- **Never auto-send.** Draft-and-stop is mandatory (project ethics rule). Quality > volume.
- **Deliverability:** verify before drafting; keep bounces <2%; prefer Gmail's own
  sending limits (~500/day, far above what we'll ever do). If volume grows, set up
  SPF/DKIM/DMARC on a real domain (guide §10.4).
- **Anti-spam / consent:** cold job outreach to a named person about a relevant role is
  legitimate, but respect India DPDP / GDPR / CAN-SPAM norms — accurate identity, easy
  to ignore, **one follow-up max**, no list-buying, no scraping behind logins (the Apify
  actor is off-account/public by design).
- **LinkedIn ToS:** keep using the off-account public Apify actor; don't inject scrapers
  into a logged-in session (guide §2.3 risk note).
- **Accuracy:** cross-verify high-value targets (CEO/CTO) via ≥2 methods before drafting
  (guide §10.3) — a bounced exec email wastes the shot.
- **Rate/credit tracking:** if P2 finder APIs are added, track remaining free credits per
  provider so we rotate instead of hard-failing.
- **Sender safety:** see the dedicated [`SENDER_SAFETY.md`](SENDER_SAFETY.md) — the #1 risk
  at this volume is **bounce rate**, fully solved by the §5 verification gate.

### 12.5 API shopping list (corrected against 2026 reality)

Verified by current research — these are the ones with a **real free API** that the engine
can call. (The guide's table lists UI/extension-only tools and stale numbers; corrections noted.)

**Finders — get keys for these (multiple accounts welcome, see §12.6):**

| Provider | Free API tier | What it gives | Priority |
|----------|---------------|---------------|----------|
| **Hunter.io** | 50/mo | Domain → email **pattern** + indexed emails + finder + **verifier** (one key, three jobs). The pattern unlocks Layer-0 for everyone. | ⭐ **Must-have** |
| **Snov.io** | ~50/mo | Email finder + verifier, OAuth REST API, all-in-one | ✅ Good |
| **Prospeo** | ~75–100 | High-accuracy finder + verify, has API | ✅ Good |
| ~~Apollo.io~~ | ❌ **No API on free plan** (free = 100 credits, UI/extension only) | — | ❌ **Don't get a key** — unusable in the engine. Use its Chrome extension manually if you want. |

**Verifiers — the anti-spam linchpin (get keys for these too):**

| Provider | Free API tier | Notes | Priority |
|----------|---------------|-------|----------|
| **ZeroBounce** | 100/mo **recurring** | API; catch-all + spam-trap + abuse + disposable detection. Best free verifier API in 2026. | ⭐ **Must-have** |
| **Hunter verifier** | (shares the 50 Hunter credits) | already have the key | ✅ |
| **MillionVerifier** | ~free credits | API; bulk-friendly | ✅ Optional |
| **Bouncer** | ~100 trial | API | ◽ Optional |
| ~~NeverBounce~~ | ❌ only **10** signup credits now (not 1,000 as the guide says) | not worth a slot | ❌ Skip |

**Free, no key needed (built into the engine):** MX lookup (Node `dns`), syntax regex,
Gmail people-chip manual check, optional SMTP probe.

**So, to answer your question — send me API keys for:**
> **Hunter.io** (⭐) · **ZeroBounce** (⭐) · **Snov.io** · **Prospeo** · *(optional: MillionVerifier, Bouncer)*.
> **Skip Apollo** (no free API). Multiple accounts per provider = more stacked free credits.

**Live findings once keys were wired in (2026-06-24):**
- **Hunter** free = **50 searches + 100 verifications/mo** → made it the **primary
  verifier** (not just finder). Domain-search returns `pattern` + `accept_all` (catch-all).
- **ZeroBounce** free here = **only 5 credits** (not 100). So it is **demoted to `--deep`
  only** — Hunter's 100 verifications do the everyday work. Top up ZeroBounce if you want
  routine spam-trap/catch-all confirmation.
- **Prospeo** old `/email-finder` is **deprecated** → engine uses the new
  **`POST /enrich-person`** (`X-KEY` header, `only_verified_email:true`). Both your keys =
  100 credits each, auto-failover.
- **Snov** finder is **async** (start → poll result) via OAuth Bearer; 50 balance. Used as
  a third finder only when Hunter+Prospeo find nothing.

### 12.6 Multi-account key pool & rotation (your "multiple API keys" idea)

> **First, an important correction:** rotating finder/verifier/Apify keys is **purely a
> discovery-quota** thing — it has **zero** effect on your email/sender reputation (that's
> governed entirely by [`SENDER_SAFETY.md`](SENDER_SAFETY.md)). More keys ≠ more spam risk;
> it just means more free lookups before you hit a limit.

Design:
- New **gitignored** `config/outreach-keys.yml` (or `.env` arrays) holding *lists* of keys:
  ```yaml
  hunter:      [key_acct1, key_acct2, key_acct3]
  zerobounce:  [key_acctA, key_acctB]
  snov:        [{id: .., secret: ..}, ...]
  prospeo:     [key1, key2]
  apify:       [token1, token2, token3]
  ```
- The engine keeps a per-key monthly usage counter and **round-robins**, failing over to
  the next key when one is exhausted (so you never hard-stop mid-search).
- Stored securely, never committed, never sent to any AI prompt.
- **Honest ToS note:** stacking many *free* accounts of the same SaaS may breach that
  provider's terms; the only consequence is *those finder accounts* could be suspended —
  it never touches your Gmail or your identity. Your call; the engine supports it either way.

**Apify multi-token:** same mechanism. Each Apify account gives ~$5/mo free platform
credit; multiple tokens = more free actor runs for the YC scraper, GitHub-emails scraper,
website extractor, and the LinkedIn public-search actor you already use. Add them to the
`apify:` list above and the engine rotates them.

---

## 13. Open decisions for the user

1. **Storage:** extend `referrals.json` with email fields, or new `data/outreach.json`?
   (Recommend: extend referrals.json — one outreach record per contact, channel = `email`.)
2. **Which P2 finder keys** (if any) to obtain — Hunter is the highest-leverage single key.
3. **Speculative-email aggressiveness** — only when no live JD, or also as a proactive
   "target company" mode independent of the scanner?
4. **Surface priority** — web sub-panel first, or CLI `outreach` mode first?
