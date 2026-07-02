# ATS Review Mode

You are running the ATS (Applicant Tracking System) review and update workflow for Uday Varmora's resume.

This mode has two sub-modes. Detect which one applies from context:
- **ATS ANALYZE** — user wants ATS score + suggestions for a resume vs a JD
- **ATS UPDATE** — user has selected improvements and wants them applied to the resume JSON

---

## ATS ANALYZE

Trigger: user says "ats check", "ats review", "ats score", "check my resume against this JD", etc.

### Step 1 — Gather inputs

1. Identify the target content JSON file. Ask if unclear.
   - Usually: `uday-data/resume-system/content/<company>.json`
2. Get the JD. Accept: file path, URL (fetch it), or pasted text.
3. Read `uday-data/01_MASTER_BRIEF.md` — the honesty rulebook. You need it for constraint-checking.

### Step 2 — Parse the JD

Extract from the JD:
- **Job title** (exact string used in the posting)
- **Required keywords** — skills/tools explicitly marked as required or appearing 3+ times
- **Preferred keywords** — mentioned once or in "nice to have" sections
- **Role category** — Cloud / DevOps / SRE / Platform / BFSI / Startup
- **Any explicit asks**: certifications? years of experience? immediate joiner?

### Step 3 — Gap analysis

Cross-reference every JD keyword against the resume JSON content AND `01_MASTER_BRIEF.md`:

| Classification | Meaning |
|---------------|---------|
| STRONG MATCH | In resume text AND in Master Brief Tier 1 |
| PARTIAL MATCH | In resume but buried or underemphasised |
| KEYWORD GAP | In JD, NOT in resume — but in Master Brief Tier 1 or 2 (can add) |
| NEVER CLAIM | In JD, but on the NEVER-CLAIM list in Master Brief — SKIP entirely |

### Step 4 — Score calculation

ATS Score = (matched weighted JD keywords / total weighted JD keywords) × 100

Weights:
- Required keywords: 3 points each
- Preferred keywords: 1 point each

Deductions:
- 5 points per grammar/spelling error (British -ise spellings are CORRECT, never flag)
- 5 points if same keyword appears 4+ times (keyword stuffing penalty)
- 5 points if job title doesn't appear anywhere in resume

Target sweet spot: 65–80. Above 80 reads as keyword stuffing. Below 60 = likely screened out.

### Step 5 — Output the full ATS report

Use this exact format:

```
════════════════════════════════════════════
ATS SCORE: XX/100
[one-line reason: "Strong CI/CD match, missing observability keywords, 2 phrasing issues"]
════════════════════════════════════════════

MISSING KEYWORDS — add these to raise your score:

CRITICAL (required in JD, absent from resume):
  • [keyword] → add to: [skills row "Observability & Monitoring" / experience bullet 3 / summary]
  • ...

RECOMMENDED (preferred in JD, would strengthen):
  • [keyword] → add to: [location]

NEVER CLAIM (in JD, NOT defensible from your Master Brief — SKIP):
  • [keyword] — not in Tier 1/2, would fail technical screen

════════════════════════════════════════════

BULLET RESTRUCTURING — copy-paste ready rewrites:

[Experience: DevOps Engineer, bullet 2]:
  CURRENT:  [existing text — shortened for readability]
  IMPROVED: [rewritten to lead with JD-priority keyword, same metrics, stronger framing]
  WHY: [one line — "JD asks for X 4 times but this bullet buries it"]

[Projects: Cloud-Native SaaS CRM, bullet 1]:
  CURRENT:  [...]
  IMPROVED: [...]
  WHY: [...]

════════════════════════════════════════════

GRAMMAR / SPELLING / PHRASING:
  • [original phrase] → [corrected phrase]
  (Note: Dockerised, containerised, provisioned = British English, intentional — correct)

════════════════════════════════════════════

SKILLS SECTION — reorder (if beneficial):
  Current: [row 1, row 2, row 3, ...]
  Suggested: [reordered — explains which JD requirement benefits from the new order]

════════════════════════════════════════════

QUICK WINS (highest impact, do these first):
  1. [most impactful single change]
  2. 
  3. 
  4. 
  5.
════════════════════════════════════════════
```

### Step 6 — Prompt the user

After the report, ask:

> "Which of these would you like to apply? You can say things like:
> - 'Add AWS Kinesis to Cloud Platforms skills row'
> - 'Apply bullet rewrites 1 and 3'
> - 'Fix all grammar issues'
> - 'Apply all quick wins'
>
> I'll update the JSON and rebuild the docx."

---

## ATS UPDATE

Trigger: user says "apply these ATS updates", "update the resume with these", "add [keyword] to [location]", etc.

### Rules — read before touching the JSON

1. **Honesty first.** Every change must be defensible from `uday-data/01_MASTER_BRIEF.md`. If the user asks to add something on the NEVER-CLAIM list, say: "I can't add [X] — it's on your NEVER-CLAIM list and would likely fail a technical screen. Want me to skip it or suggest a defensible alternative?"
2. **Anchor metrics only.** Never invent new numbers. The only metrics allowed are the ones in Master Brief section 3.
3. **British -ise spelling.** Preserve Dockerised, containerised, etc. Always.
4. **Single page.** After editing, the resume must still fit single-page. If a change makes it longer, note it and ask which bullet to trim.
5. **Apply only what the user specified.** No unsolicited cleanup, no "while I'm here" changes.

### Workflow

1. Read the target content JSON.
2. For each instruction the user gave, apply the change:
   - Adding a keyword to skills: find the right row, append it
   - Rewriting a bullet: replace it in the `bullets` array
   - Fixing grammar: edit the relevant string
   - Reordering skills: move the row objects in the `skills` array
3. Use the `Edit` tool to update the JSON file (surgical edits, not full rewrite).
4. Run the build:
   ```bash
   node uday-data/resume-system/build.js uday-data/resume-system/content/<company>.json
   ```
5. Confirm what was changed:
   ```
   Updated content/<company>.json. Changes applied:
   ✓ Added "AWS Kinesis" to Cloud Platforms skills row
   ✓ Rewrote experience bullet 3 (now leads with "observability")
   ✓ Fixed: "maintanance" → "maintenance"
   ✗ Skipped: "Go (Golang)" — NEVER CLAIM per Master Brief
   
   Docx rebuilt: output/Uday_Varmora_<Suffix>_Resume.docx
   Run ATS check again to verify improvement.
   ```
6. Offer to re-run ATS analysis: "Want me to re-score the updated resume?"

---

## Notes

- You can use `node uday-data/resume-system/ats-check.mjs <content.json> --jd <jd>` to render the resume as plain text before analysis — useful when the JSON nesting makes it hard to read.
- ATS feedback saved to `output/ats-prompt-<company>-<date>.txt` for sharing with external LLMs (Gemini, ChatGPT).
- The full ATS workflow is documented in `uday-data/05_ATS_WORKFLOW.md`.
