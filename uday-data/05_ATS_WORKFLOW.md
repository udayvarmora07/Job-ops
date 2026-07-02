# ATS Review & Update Workflow

The complete loop: generate resume → get ATS score → pick improvements → update → repeat until score is good.

---

## The Full Loop

```
JD arrives
    ↓
[1] GENERATE  →  Tailored content JSON + built docx
    ↓
[2] ATS CHECK →  Score / missing keywords / grammar fixes
    ↓
[3] REVIEW    →  You pick which suggestions to apply (you decide, AI never auto-applies)
    ↓
[4] UPDATE    →  Claude Code applies your chosen changes, rebuilds docx
    ↓
[5] RE-CHECK  →  Run ATS again. Loop until score is ≥ 70 and no mistakes.
    ↓
FINALIZE      →  Submit this resume
```

---

## Step 1 — Generate (existing workflow)

Ask Claude Code: `"tailor my resume for this JD"` + paste JD (or give URL).

Claude will:
1. Run the `02_JD_TAILORING_PROMPT.md` workflow (STEP 1–4)
2. Create `uday-data/resume-system/content/<company>.json`
3. Build the docx: `output/Uday_Varmora_<Company>_<Role>_Resume.docx`

---

## Step 2 — ATS Check

**Option A — Inside Claude Code (recommended, zero copy-paste):**

```
You: "ats review content/nexthink.json" + paste the JD
```

Claude reads the JSON, runs deep ATS analysis, gives you the structured report with score, missing keywords, bullet rewrites, grammar fixes, and quick wins.

**Option B — External LLM (Gemini / ChatGPT / Claude.ai):**

```bash
# Generate the ATS prompt file
node uday-data/resume-system/ats-check.mjs uday-data/resume-system/content/nexthink.json --jd jds/nexthink.txt

# Or with JD as text:
node uday-data/resume-system/ats-check.mjs content/nexthink.json --jd "Senior Platform Engineer at Nexthink..."
```

Output saved to: `output/ats-prompt-nexthink-YYYY-MM-DD.txt`

Copy that file → paste into Gemini / ChatGPT / Claude.ai → get the ATS report.

---

## Step 3 — Review Suggestions (you decide)

The ATS report gives you suggestions. **You choose which to apply.** Typical decisions:

| Suggestion type | Your call |
|-----------------|-----------|
| Add a keyword you actually know | ✅ Add it |
| Add a keyword you don't know but want to learn | ✅ Add it — prep before interview |
| Fix a grammar/spelling mistake | ✅ Always fix |
| Reorder skills section | ✅ Quick win, zero risk |
| Add a NEVER-CLAIM tool | ❌ Skip — you'll fail the technical screen |
| Rewrite a bullet | ✅ if it sounds better, ❌ if it overstates |

**The honesty line:** Adding a keyword you'll learn before the interview = fair game. Adding skills you've never touched = career risk.

---

## Step 4 — Update Resume

Tell Claude Code what you selected. Be as specific or loose as you want:

**Specific instructions (Claude applies exactly what you say):**
```
Apply these ATS updates to content/nexthink.json:
- Add "AWS Kinesis" to the Cloud Platforms skills row
- Rewrite experience bullet 3 to lead with "observability platform" instead of "root-cause analysis"
- Fix: "maintanance" → "maintenance" in project 2
- Move Observability & Monitoring row to position 2 in skills (JD emphasis)
```

**Loose instructions (Claude picks the best way to apply):**
```
Apply quick wins 1, 2, 3 and all grammar fixes from the last ATS report to content/nexthink.json
```

**Post-update, Claude will:**
1. Edit the JSON surgically (no unsolicited changes)
2. Run `node uday-data/resume-system/build.js uday-data/resume-system/content/nexthink.json`
3. Tell you exactly what changed and what was skipped (honesty violations)

---

## Step 5 — Re-check

Run ATS again on the updated version:

```
You: "ats review content/nexthink.json" + JD
```

Or with the script:
```bash
node uday-data/resume-system/ats-check.mjs content/nexthink.json --jd jds/nexthink.txt
```

Loop until:
- ATS score ≥ 70 (sweet spot: 70–80)
- No grammar/spelling errors
- You can defend every bullet in an interview

---

## Step 6 — Finalize

Once you're happy:
1. The docx is at `output/Uday_Varmora_<Company>_<Role>_Resume.docx`
2. Update your applications tracker

---

## Honesty Rules (from `01_MASTER_BRIEF.md`)

These apply even when ATS suggestions tell you to add something:

| Rule | What it means |
|------|--------------|
| Tier 1 tools only as "proficient" | Jenkins, GitLab CI/CD, GitHub Actions, AWS (core services), Terraform, Kubernetes, Docker, Prometheus, Grafana, Loki, ELK, Datadog, HashiCorp Vault, Python, Bash |
| Tier 2 tools = honest framing | "exposure", "used in X project", not "proficient" |
| Azure = "Fundamentals" framing only | Never claim Azure depth |
| NEVER CLAIM list | Go, GCP depth, OpenTelemetry, ML model serving, GPU-on-K8s, chaos engineering — these NEVER appear |
| Anchor metrics only | The numbers in Master Brief section 3. Never invent new ones. |
| Experience = "1+ year" | Never "1.5 years" or specific months |
| EKS upgrade = v1.33 → v1.34 | Never substitute other versions |
| British -ise spelling | Dockerised, containerised — intentional, never "fix" these |

---

## ATS Score Targets

| Score | Meaning |
|-------|---------|
| < 50 | Likely screened out before human review |
| 50–65 | Human might see it; keyword match weak |
| 65–80 | **Sweet spot** — strong keyword match, not stuffed |
| > 80 | Risk of keyword stuffing penalty in modern ATS |
| 100 | Keyword stuffed — will be penalised or look fake |

---

## Quick Reference — Commands

```bash
# Generate resume for a company
node uday-data/resume-system/build.js uday-data/resume-system/content/company.json

# ATS check with JD file
node uday-data/resume-system/ats-check.mjs content/company.json --jd jds/company.txt

# ATS check with JD as text
node uday-data/resume-system/ats-check.mjs content/company.json --jd "paste JD here"

# Claude Code ATS review (no script needed)
# Just say: "ats review content/company.json" and paste the JD
```
