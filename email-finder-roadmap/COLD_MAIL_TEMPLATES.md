# Cold-Mail Templates — Research & A/B Design

> **What this is:** the reasoning behind the 5 cold-mail templates in
> `lib-outreach/templates.mjs`, tuned for the **India job market** and **remote
> roles**, plus how the system A/B-tests them. Source of the live templates is the
> code; this doc explains *why*. Pairs with [`SENDER_SAFETY.md`](SENDER_SAFETY.md)
> (deliverability) and [`OUTREACH_PLAN.md`](OUTREACH_PLAN.md) (the engine).

## What actually moves cold-email reply rates (the evidence)

Across sales/recruiting cold-email research the same levers recur, and they map
cleanly onto a job-seeker emailing a recruiter or hiring manager:

1. **Short wins.** Mails under ~75–125 words consistently out-reply long ones.
   Recruiters skim on mobile. → every template caps the body at ≤5 sentences
   (the `soft-ask` at 3). This is also a hard rule in `cold-email.mjs`.
2. **One clear CTA.** Multiple asks split attention and lower replies. → each
   template ends with exactly one CTA.
3. **Specific, honest subject lines** beat hypey ones. ALL-CAPS / "URGENT" / "!!!"
   tank deliverability and trust. → subjects are specific + lowercase-normal.
4. **Personalisation that proves you read the post** is the single biggest
   reply-rate lever when a genuine hook exists. → the `warm-hook` template.
5. **Proof / quantified results** earn replies from technical hiring managers and
   founders far more than soft claims. → the `proof-first` and `problem-solution`
   templates lead with metrics. Metrics come ONLY from the candidate's real
   anchor data (`uday-data/01_MASTER_BRIEF.md`) — never invented.
6. **Make the "yes" cheap.** A permission-style question ("is this the right
   address to send my CV?") is the lowest-friction reply. → the `soft-ask` template.
7. **Deliverability first.** None of the above matters if you land in spam or
   bounce — see `SENDER_SAFETY.md`. We verify-before-draft and never auto-send.

No single template wins for everyone — which is exactly why we rotate and measure.

## The 5 templates

| id | Name | Technique | Best for |
|----|------|-----------|----------|
| `direct-match` | Direct Role-Match | Classic direct application | In-house recruiters / clear JD |
| `proof-first` | Proof-First | AIDA (metric-led hook) | Eng managers / founders |
| `problem-solution` | Problem-Solution | PAS (Problem-Agitate-Solve) | Startup CTO/founder / speculative |
| `warm-hook` | Warm-Hook | Personalisation-led | Anyone, when a real hook exists |
| `soft-ask` | Soft-Ask | Permission / short question | Busy + agency recruiters, high-volume posts |

## India-market tuning (applied across all 5)

- **Formal-but-warm greeting** — "Dear {Name}" / "Hello {Name}". Indian business
  email skews more formal than US cold email; never open with just a first name + dash.
- **Lead the CV, don't gate it.** Indian recruiters expect the résumé attached up
  front, not "let's chat first then I'll send it." Every template attaches the CV.
- **State notice period + current location + remote-readiness.** These are the
  first three things an Indian recruiter asks — answering pre-emptively saves a round-trip.
- **No hype, no over-familiarity.** Specific honest subject; respectful close.
- **Agency vs in-house recruiters:** agency recruiters (third-party, posting on
  behalf of a client) screen high volume → `soft-ask`/`direct-match` fit best;
  in-house TA and hiring managers tolerate a bit more proof → `proof-first`.

## Remote-role tuning (applied across all 5)

- **Lead with outcomes** — results are location-independent; let them carry the mail.
- **Name timezone overlap + async working style + self-management** in one line.
- **Echo the "remote" detail from the post** so it's clear you read it (esp. `warm-hook`).

## Subject lines (researched)

What gets a cold job-outreach email opened (2026 cold-email + recruiter data):
- **Short** — 4–7 words, under ~50 characters; most important words first (recruiters skim on mobile).
- **All lowercase**, specific, honest. Avoid ALL-CAPS and spam words ("urgent", "apply now",
  "free", "opportunity of a lifetime") — they sink opens *and* deliverability.
- **Personalization** (company name, a real post/announcement detail) lifts open rates the most.
- Avoid the weak passive "applying for your {role} role".
- Proven patterns the composer picks from (varies by template, good for A/B):
  - role + credential/metric — `devops engineer — 82% faster ci/cd, aws + k8s`
  - application + name + exp — `devops engineer application — uday varmora, 1+ yr`
  - value to the company — `helping {company} ship faster and more reliably`
  - personalized question — `is {company} still hiring a devops engineer?`

Sources: [Instantly](https://instantly.ai/blog/cold-email-subject-lines-for-recruiting-100-examples-to-increase-reply-rates/),
[Mixmax](https://www.mixmax.com/blog/cold-email-subject-lines-2026),
[Pin](https://www.pin.com/blog/recruiter-email-subject-lines/),
[BestJobSearchApps](https://bestjobsearchapps.com/articles/en/best-subject-line-for-job-application-email-10-proven-examples-that-get-opened-in-2026).

## Plain text, no markdown

Cold emails are plain text — markdown like `**bold**` shows up as literal `**asterisks**` and
looks broken. The composer is instructed to use no emphasis symbols, and `parseColdEmail` strips
any stray `**`/`__`/`*` as a safety net. Key skills stand out through wording, not formatting.

## How the A/B test works

- **Even rotation, not random.** `nextTemplate(records)` picks the **least-used**
  template across past outreach, so the 5 stay balanced and reply-rate comparisons
  are meaningful sooner. The chosen `templateId` is stored on the outreach record.
- **Outcome is free.** The outreach store already tracks status
  (`drafted → sent → replied / no_response / bounced / closed`). So
  `templateStats(records)` computes, per template: how many went out and the
  **reply-rate** (`replied ÷ (sent + replied + no_response + bounced)`).
- **Read it** in the Outreach tab's template-stats strip (and later a CLI
  `outreach templates`). After ~10–15 sent per template the winner becomes visible;
  until then treat differences as noise.
- **Honesty about the data:** rotation gives clean attribution only if you keep
  *sending* across templates — if you cherry-pick one template manually, the
  comparison degrades. The system rotates for you to avoid that bias.
