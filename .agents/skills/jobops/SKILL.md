---
name: jobops
description: AI job search command center -- evaluate offers, generate CVs, scan portals, track applications
arguments: mode
user_invocable: true
user-invocable: true
argument-hint: "[scan | deep | pdf | latex | cover | oferta | ofertas | apply | batch | tracker | pipeline | contacto | training | project | interview-prep | interview | patterns | followup | update]"
license: MIT
---

# jobops -- Router

## Mode Routing

Determine the mode from `$mode`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` -- Show command menu |
| JD text or URL (no sub-command) | **`auto-pipeline`** |
| `oferta` | `oferta` |
| `ofertas` | `ofertas` |
| `contacto` | `contacto` |
| `deep` | `deep` |
| `interview-prep` | `interview-prep` |
| `interview` | `interview` |
| `pdf` | `pdf` |
| `latex` | `latex` |
| `training` | `training` |
| `project` | `project` |
| `tracker` | `tracker` |
| `pipeline` | `pipeline` |
| `apply` | `apply` |
| `scan` | `scan` |
| `batch` | `batch` |
| `patterns` | `patterns` |
| `followup` | `followup` |
| `update` | `update` |
| `cover` | `cover` |

**Auto-pipeline detection:** If `$mode` is not a known sub-command AND contains JD text (keywords: "responsibilities", "requirements", "qualifications", "about the role", "we're looking for", company name + role) or a URL to a JD, execute `auto-pipeline`.

If `$mode` is not a sub-command AND doesn't look like a JD, show discovery.

---

## Discovery Mode (no arguments)

Show this menu:

```
jobops -- Command Center

Available commands:
  /jobops {JD}      → AUTO-PIPELINE: evaluate + report + PDF + tracker (paste text or URL)
  /jobops pipeline  → Process pending URLs from inbox (data/pipeline.md)
  /jobops oferta    → Evaluation only A-F (no auto PDF)
  /jobops ofertas   → Compare and rank multiple offers
  /jobops contacto  → LinkedIn power move: find contacts + draft message
  /jobops deep      → Deep research prompt about company
  /jobops interview-prep → Generate company-specific interview prep doc
  /jobops interview    → Interactive profile/CV onboarding interview
  /jobops pdf       → PDF only, ATS-optimized CV
  /jobops latex     → Export CV as LaTeX/Overleaf .tex
  /jobops cover     → Cover letter: standalone JD paste or /jobops cover {slug}
  /jobops training  → Evaluate course/cert against North Star
  /jobops project   → Evaluate portfolio project idea
  /jobops tracker   → Application status overview
  /jobops apply     → Live application assistant (reads form + generates answers)
  /jobops scan      → Scan portals and discover new offers
  /jobops batch     → Batch processing with parallel workers
  /jobops patterns  → Analyze rejection patterns and improve targeting
  /jobops followup  → Follow-up cadence tracker: flag overdue, generate drafts
  /jobops update    → Update jobops system files with diff preview + compat check

Inbox: add URLs to data/pipeline.md → /jobops pipeline
Or paste a JD directly to run the full pipeline.
```

---

## Context Loading by Mode

After determining the mode, load the necessary files before executing:

### Modes that require `_shared.md` + their mode file:
Read `modes/_shared.md` + `modes/{mode}.md`

Applies to: `auto-pipeline`, `oferta`, `ofertas`, `pdf`, `contacto`, `apply`, `pipeline`, `scan`, `batch`

### Standalone modes (only their mode file):
Read `modes/{mode}.md`

Applies to: `tracker`, `deep`, `interview-prep`, `interview`, `latex`, `training`, `project`, `patterns`, `followup`, `cover`

### Modes delegated to subagent:
For `scan`, `apply` (with Playwright), and `pipeline` (3+ URLs): launch as Agent with the content of `_shared.md` + `modes/{mode}.md` injected into the subagent prompt.

```
Agent(
  subagent_type="general-purpose",
  prompt="[content of modes/_shared.md]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="jobops {mode}"
)
```

Execute the instructions from the loaded mode file.
