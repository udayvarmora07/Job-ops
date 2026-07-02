# Sender Safety & Deliverability — Zero-Risk Cold Outreach

> **Your concern:** "I don't want my emails to go to spam, and I don't want to
> damage my sender reputation. No risk."
> **This doc:** the in-depth, 2026-current protocol for exactly that. Read §1 first —
> it changes everything about how to think about the risk.

---

## 1. The reframe that matters most

Almost every "cold email deliverability" article online is written for **bulk sales
senders** — people blasting 200–2,000 emails/day to scraped lists. Their playbook
(buy 3–5 secondary domains, 6-week automated warm-up, rotate domains every 6–9 months,
cap 35–45/day) is **the wrong playbook for you** and following it would be wasted effort.

**Your actual use case:** a job seeker sending a **handful of genuinely personalized,
1-to-1 emails** to *relevant, named* decision-makers — often after engaging with them on
LinkedIn first. To a mailbox provider, that profile looks like normal human
correspondence, not spam. At this volume and personalization, the spam risk is **low by
default** — *as long as you don't shoot yourself in the foot.*

The thing that actually damages a sender at your volume is almost never "infrastructure."
It is **bounces** and **spam complaints**. Get those two right and you are safe.

---

## 2. The #1 reputation killer: bounce rate (this is the whole ballgame)

This is the single most important fact in this document:

- Google's 2026 guidance treats a **sustained bounce rate above 2%** as a spam-filtering
  trigger **across your entire address/domain** — not just the messages that bounced.
- Senders under 2% bounce keep inbox placement **above 85%**. At 3–5% it drops to 60–70%.
  Above 5%, **half your mail goes to spam or is rejected outright.**
- **Hard bounces** (the mailbox doesn't exist) are the most damaging — they signal
  "this person is guessing addresses," which is exactly spammer behavior.
- By the time you *see* a high bounce rate, the damage is already done. Google starts
  filtering the moment bounces form a pattern. ([litemail][1], [aerosend][2])

**Why this is good news for you:** bounces are 100% preventable with verification. If
every address is verified *valid* before you draft, your bounce rate stays near 0% and
your reputation never gets the chance to degrade.

**→ Hard rule for the engine: never create a draft to an unverified address.** Guessed/
permuted emails must pass verification (§ below) first, or they go to the "manual-check"
pile (you confirm via the Gmail people-chip trick) — they are *never* auto-drafted.

### The verification ladder (cheapest/safest first)
1. **Syntax** — RFC regex. Free, instant.
2. **MX record lookup** — Node `dns.promises.resolveMx(domain)`. No MX = discard.
3. **Catch-all detection** — if the domain accepts *any* address, mark `risky`, never
   `valid`. A catch-all "valid" result is meaningless and can still bounce or annoy.
4. **Mailbox verification API** — ZeroBounce / Hunter verifier (see [API list](#api)).
   Returns `valid / invalid / catch-all / role-based / disposable`.
5. **Gmail people-chip** (manual, free) — for the last-mile human check on a high-value
   target: paste into Gmail "To:", hover for the profile card.

Only `valid` (non-catch-all, non-disposable) addresses get auto-drafted.

---

## 3. Sender identity: which "From" address to use

You currently send from a **free `@gmail.com`**. Two viable paths, with an honest trade-off:

| Option | Spam risk to you | Effort/cost | Verdict |
|--------|------------------|-------------|---------|
| **A. Your personal Gmail** (`varmorauday1045@gmail.com`) | Low **if** strictly 1:1 + verified recipients + low volume. Google auto-handles SPF/DKIM/DMARC for `@gmail.com`, so you pass authentication automatically. Downside: if you ever *did* get complaints, it's your *primary* identity at stake. | $0, zero setup | **Fine for now** at your volume. Lowest effort. |
| **B. Dedicated Google Workspace on a cheap custom domain** (e.g. `uday@udayvarmora.dev`) | Lowest risk to your *primary* identity — outreach lives on a separate, professional address. Looks more credible to recruiters. Requires you to set up SPF + DKIM + DMARC DNS records once. | ~₹130–400/mo Workspace + ~₹800/yr domain; ~1 hr setup | **Recommended upgrade** if you'll do this regularly. A professional domain also *raises* reply rates. |

**What you should NOT do** (this is the bulk-sender advice that doesn't apply to you):
- ❌ Don't buy multiple "secondary" throwaway domains and rotate them.
- ❌ Don't run an automated inbox "warm-up" service.
- ❌ Don't worry about dedicated IPs.
These are for people sending hundreds/day. For genuine 1:1 job outreach they add cost,
complexity, and — ironically — can look *more* like a spam operation.

**My recommendation:** Start with **Option A** (personal Gmail) for the first batches.
If outreach becomes a steady habit, move to **Option B** so your job-hunt mail is
firewalled from your primary identity and looks more professional. Either way, the
safety comes from §2 (verification) + §4 (discipline), not from the address type.

---

## 4. Sending discipline (the human-pace rules the engine will enforce)

Even at low volume, a few habits keep you firmly in "normal human" territory:

- **Volume cap:** start ≤ 5–10 outreach emails/day; never exceed ~20/day from a personal
  Gmail. (Free Gmail's hard limit is ~500/day, but inbox rates fall off a cliff well
  before that for *cold* mail. You'll never be near 500, so the cap is really about
  looking human.)
- **Pace, don't burst:** space sends out (the engine drafts; *you* send across the day).
  A sudden burst of 30 near-identical emails is the clearest spam signal there is.
- **Genuine 1:1 personalization:** every email references the specific person, company,
  and role. No mail-merge feel. This is both the anti-spam shield *and* what gets replies.
- **One follow-up, then stop.** A single polite nudge after ~5–7 days is fine. Repeated
  follow-ups to a non-responder raise complaint risk and burn goodwill.
- **Dedup against history:** before drafting, search your Gmail (`search_threads`) so you
  never re-email someone you've already contacted.
- **Always include a real signature + an easy out.** Full name, phone, LinkedIn, and a
  line like "no worries if this isn't the right time / not the right person — feel free
  to ignore." A clear opt-out path keeps complaint rates at zero.

---

## 5. Content rules (avoid the filter triggers)

- **Subject:** specific and honest. `DevOps Engineer application — Uday Varmora`. Avoid
  ALL-CAPS, `!!!`, "URGENT", "FREE", money/$$$ words, deceptive lines.
- **Body:** short (under ~5 sentences per the research), plain text or very light HTML.
  No big images, no link-heavy footers, no tracking pixels (open-tracking pixels are a
  known spam signal — leave them off).
- **Attachments — handle with care.** A single, reasonably-sized **PDF résumé** is normal
  and fine. But heavy attachments and "suspicious" attachments can raise soft bounces /
  filtering. Safer pattern for cold first-touch:
  - **Preferred:** mention the résumé and offer it ("happy to send my résumé / link
    below"), OR attach **one** lightweight PDF (< ~1 MB).
  - **Alternative:** link to the résumé (a clean Drive/portfolio link) instead of
    attaching on the very first cold email, then attach once they reply. Fewer first-touch
    attachments = fewer filter triggers. The engine will support both modes.
- **Links:** keep to 0–1 (your LinkedIn or portfolio). Many links = spam signal.
- **No spam-trigger phrases**, no URL shorteners (bit.ly etc. are heavily filtered).

---

## 6. Warm-up the *human* way (not the software way)

You don't need a warm-up *service*. You need **prior engagement**, which the research
shows lifts both deliverability and reply rates:
- Before emailing a target, **connect/engage on LinkedIn** first (your existing referral
  engine already finds these people and drafts the LinkedIn message). A recipient who
  recognizes your name is far less likely to mark you as spam.
- Where possible, get the LinkedIn touch in *first*, then the email references it
  ("we connected on LinkedIn about the {role} role…"). That single line converts a "cold"
  email into a "warm" one in the filter's eyes and the recipient's.

---

## 7. The pre-send safety gate (engine-enforced checklist)

Before the engine is allowed to create *any* Gmail draft, it must pass **all** of:

- [ ] Recipient email status == `valid` (verified; not catch-all/disposable/role-based,
      unless you explicitly accept a role-based fallback like `careers@`).
- [ ] Domain has MX records.
- [ ] Not a duplicate of someone already contacted (Gmail thread search clean).
- [ ] Daily send cap not exceeded.
- [ ] Body ≤ ~5 sentences, ≤ 1 link, ≤ 1 attachment (< 1 MB), no spam-trigger words.
- [ ] Real signature + soft opt-out line present.
- [ ] **Draft only — never auto-send.** You review and click Send yourself.

If any check fails → no draft; the engine tells you why and (for unverified emails) drops
the address into the manual-check list instead.

---

## 8. Monitoring (catch problems before they cost you)

- **Track your own bounces.** The engine logs every send outcome; if any address bounces,
  it's flagged so you never reuse a bad pattern, and the source that produced it is
  down-weighted.
- **Google Postmaster Tools** — free; if you move to a custom domain (Option B), register
  it here to watch spam-rate and reputation. (For a personal `@gmail.com` you can't see
  Postmaster data, which is another reason Option B is the cleaner long-term path.)
- **Keep spam complaints at ~0** by only ever emailing relevant, named people with a clear
  opt-out. At your volume, even one or two complaints is worth investigating.

---

## 9. Bottom line for Uday

1. **Verification is your seatbelt.** Never draft to an unverified address. This alone
   removes ~all of the real risk. (§2)
2. **Personal Gmail is acceptable now**; a cheap Workspace custom domain is the clean
   upgrade if this becomes routine. (§3)
3. **Stay genuinely 1:1 and low-volume.** Ignore the bulk-sender / secondary-domain /
   warm-up-software advice — it's not for you. (§4)
4. **Short plain emails, one PDF (or a link), one follow-up max.** (§5–6)
5. **The engine drafts; you send.** Every safety check runs before a draft exists. (§7)

> **Important decoupling:** rotating *finder / Apify API keys* (your other question) has
> **zero** effect on your sender reputation. Those keys only affect how many *lookups* you
> can do — they never touch your mailbox. Sender safety comes entirely from §2–§7. See
> [`OUTREACH_PLAN.md` §4/§13](OUTREACH_PLAN.md) for the API key list and the multi-key
> rotation design.

---

### Sources
- [litemail — bounce rate fix 2026][1]
- [aerosend — cold email bounce rate benchmarks][2]
- [Google email sender guidelines][3]
- [Gmass — Gmail bulk sender rules actually enforced 2026][4]
- [unifygtm — cold email 2026 domains & deliverability][5]
- [woodpecker — free Gmail vs custom domain][6]

[1]: https://litemail.ai/blog/cold-email-bounce-rate-fix-2026
[2]: https://www.aerosend.io/cold-email/cold-email-bounce-rate/
[3]: https://support.google.com/a/answer/81126
[4]: https://www.gmass.co/blog/gmail-bulk-sender-guidelines/
[5]: https://www.unifygtm.com/explore/cold-email-2026-domain-setup-deliverability-sequences
[6]: https://woodpecker.co/blog/free-email-or-custom-domain-email-which-one-is-better-for-cold-emailing/
