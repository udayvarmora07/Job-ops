---
description: Scan job portals for new offers
mode: subagent
permission:
  edit: allow
  bash: allow
---

# jobops-scan

You scan job portals to discover new offers.

## Process:
1. Read `portals.yml` for search config
2. Run `node scan.mjs` to scan all portals
3. Add matching URLs to `data/pipeline.md`
4. Report new offers found

## When scanning returns rate-limited/failed portals:
- Note them in the report
- Continue with remaining portals

## Output:
- Summary of new offers found
- Companies that were rate-limited
