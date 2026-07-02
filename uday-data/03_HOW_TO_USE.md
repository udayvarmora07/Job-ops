# How to Use Your JD-Tailoring System

You now have two files:
- `01_MASTER_BRIEF.md` — your single source of truth (all defensible facts)
- `02_JD_TAILORING_PROMPT.md` — the workflow Claude follows for each JD

Here are 3 ways to use them, from easiest to most powerful. Pick one based on time investment.

---

## Option A — Quick & Casual (zero setup, per-chat workflow)

**Best for:** Trying it out, one-off applications.

**Steps for each application:**
1. Open a new Claude chat (claude.ai)
2. Upload `01_MASTER_BRIEF.md` as a file attachment
3. Paste the entire `02_JD_TAILORING_PROMPT.md` content into the chat
4. At the bottom where it says "paste below", paste the actual JD
5. Send

Claude will run STEP 1 → STEP 5 and produce a tailored docx.

**Pros:** Zero setup, works today.
**Cons:** Have to re-upload Brief every chat. 2-3 minutes overhead per application.

---

## Option B — Claude Project (RECOMMENDED, 5-min setup)

**Best for:** Active job search. This is the cleanest workflow.

**One-time setup:**
1. Go to claude.ai → "Projects" → "Create Project"
2. Name it: "Uday Resume Tailoring"
3. In "Project knowledge", upload `01_MASTER_BRIEF.md`
4. In "Custom Instructions", paste the entire `02_JD_TAILORING_PROMPT.md`
5. Save the project

**For each application:**
1. Open the project, click "New chat"
2. Paste just the JD (no need to re-explain anything — the project remembers)
3. Claude runs the workflow → outputs analysis, plan, then build script
4. Approve the plan → Claude generates the docx
5. Download the docx from `/mnt/user-data/outputs/`

**Pros:** Persistent context, 60-90 seconds per application, consistent output.
**Cons:** 5 minutes one-time setup.

This is what I recommend for you. You have Claude Pro, you have the build scripts, and this turns the per-application cost from 45 minutes down to about 60 seconds.

---

## Option C — Claude Code Slash Command (most powerful, 1-hour setup)

**Best for:** Power users who want it CLI-driven and version-controlled.

You already have a `resume-app` directory from earlier in our conversation. Extend it:

1. Add to `resume-app/.claude/commands/tailor.md`:
   ```
   You are tailoring Uday's resume to a job description.
   
   1. Read `master-content/MASTER_BRIEF.md` (this is the source of truth)
   2. Read `master-content/JD_TAILORING_PROMPT.md` (this is the workflow)
   3. Read the JD that the user just pasted
   4. Run the 5-step workflow
   5. Generate `build_<company>_<role>.js` based on `build_universal.js`
   6. Run: `node build_<company>_<role>.js`
   7. Verify single page, present file path
   ```

2. Copy `01_MASTER_BRIEF.md` to `resume-app/master-content/MASTER_BRIEF.md`
3. Copy `02_JD_TAILORING_PROMPT.md` to `resume-app/master-content/JD_TAILORING_PROMPT.md`

**For each application:**
1. `cd resume-app`
2. `claude` (start Claude Code)
3. `/tailor` (paste JD when prompted)
4. Approve plan → docx generated in `output/`

**Pros:** Fully automated, version-controlled, can integrate with git for application tracking.
**Cons:** Most setup time. Requires Claude Code installed (already done for you).

---

## Recommended Workflow for You

Given that you're actively job-hunting and want the easiest paste-JD-get-resume experience:

**Use Option B (Claude Project).**

Set it up once (5 minutes), then for every JD it's literally:
1. Open the project
2. Paste JD
3. Get tailored resume

If you want to invest more time later, upgrade to Option C — but Option B handles 95% of the value with 10% of the setup.

---

## Anti-patterns to avoid

Based on research from Jobscan, Resume Worded, and Enhancv:

1. **Don't aim for 100% keyword match.** Sweet spot is 60-80%. Above 80% reads as keyword stuffing and modern ATS systems penalize it.
2. **Don't change tools you don't actually know.** If a JD asks for Puppet and you don't know Puppet, mark it as a gap. Adding "Puppet" to your skills will get exposed in the technical interview.
3. **Don't reuse the same tailored resume across companies.** Even similar-titled jobs at different companies have different keyword emphasis.
4. **Don't tailor your projects to fabricate scope.** The Salon SaaS project did 30+ Lambda functions, not 300. Don't inflate.
5. **Don't add buzzwords like "passionate", "team player", "synergy".** Modern AI ATS systems flag these as low-signal filler.

---

## Maintenance

**Update the Master Brief when:**
- You finish a new project (add to project inventory)
- You earn a new certification
- You hit a new defensible metric (e.g., scale up to 99.99% uptime)
- You learn a new tool to genuine production depth (add to Tier 1)
- You add new exposure to a tool (add to Tier 2)

**Re-run all four existing resumes when you update the Brief**, so all the variants stay in sync.

---

## Honesty boundary checks (run these mentally before submitting any tailored resume)

For every tailored resume Claude produces, check:

1. Can I defend every bullet in a 30-minute technical interview?
2. If they ask "Tell me about the cost optimization work" — do I have a 5-minute story ready?
3. If they ask "What's the difference between Karpenter and KEDA?" — can I explain it?
4. If they ask "Why did you choose Sealed Secrets over External Secrets Operator?" — do I have a real answer?
5. If the JD says "5+ years" and you have 1+ year, did the resume claim more? It shouldn't.

If you can't answer "yes" to all five, the resume is over-promising. Send it back to Claude with: "I can't defend X bullet — please remove or soften."

The goal is interviews, not just callbacks. A great resume that gets you an interview where you fail the technical screen is worse than a slightly weaker resume that gets you an interview you crush.
