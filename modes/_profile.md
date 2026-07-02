# User Profile Context -- career-ops

<!-- ============================================================
     THIS FILE IS YOURS. It will NEVER be auto-updated.
     
     Customize everything here: your archetypes, narrative,
     proof points, negotiation scripts, location policy.
     
     The system reads _shared.md (updatable) first, then this
     file (your overrides). Your customizations always win.
     ============================================================ -->

## Your Target Roles

<!-- Replace these with YOUR target roles. Examples:
     - Senior Backend Engineer / Staff Platform Engineer
     - AI Product Manager / Technical PM
     - Data Engineer / ML Engineer
     - DevOps / SRE / Platform
     Whatever you're optimizing for. -->

| Archetype | Thematic axes | What they buy |
|-----------|---------------|---------------|
| **DevOps Engineer** | CI/CD pipelines, release automation, Terraform IaC, Linux system administration | Someone who automates software delivery and cuts release cycle times |
| **Site Reliability Engineer (SRE)** | Kubernetes (EKS/OpenShift) orchestration, observability, incident response, disaster recovery (Velero) | Someone who sustains 99.9% uptime SLA and reduces production MTTR |
| **Cloud Engineer (AWS)** | AWS infrastructure design, serverless (Lambda/SAM), cost optimization (Karpenter/KEDA) | Someone who designs secure, highly available, and cost-efficient cloud architectures |
| **Platform Engineer** | Terraform modules, infrastructure standardization, developer enablement | Someone who builds secure self-service infrastructure for engineering teams |
| **CI/CD / Release Engineer** | Pipeline construction, release safety, build tooling, artifact registries | Someone who guarantees fast, secure, and reproducible release processes |
| **Infrastructure Engineer** | AWS cloud provisioning, networking, disaster recovery, security policies | Someone who builds stable, scalable, and secure system environments |
| **Systems Engineer** | Linux OS administration, root-cause troubleshooting, script automation | Someone who keeps servers healthy, automates system toil, and resolves incidents |

## Your Adaptive Framing

<!-- Map YOUR projects to each archetype. Example:
     | Platform / LLMOps | My monitoring dashboard project | article-digest.md |
     | Agentic | My chatbot with HITL escalation | cv.md section 3 | -->

| If the role is... | Emphasize about you... | Proof point sources |
|-------------------|------------------------|---------------------|
| DevOps Engineer | Pipeline speed, Terraform modules, build automation, release frequency | cv.md + master brief |
| Site Reliability Engineer (SRE) | Production uptime, incident RCA, Velero disaster recovery, Prometheus/Grafana monitoring | cv.md + master brief |
| Cloud Engineer (AWS) | AWS resource depth, serverless SAM/Lambda, EFS dependency layer, compute cost optimization | cv.md + master brief |
| Platform Engineer | Golden paths, Terraform reusable module libraries, containerization | cv.md + master brief |
| CI/CD / Release Engineer | Jenkins, GitLab, GitHub Actions, CodePipeline automation, dual GHCR/ECR Dual-Registry, build speed | cv.md + master brief |
| Infrastructure Engineer | Multi-AZ/Region VPCs, Terraform remoto state/locking, Velero DR plans, IAM least-privilege policies | cv.md + master brief |
| Systems Engineer | Linux administration, incident triage, Python/Bash automation scripting, 70% toil reduction | cv.md + master brief |

## Your Exit Narrative

<!-- Replace with YOUR story. This frames everything. -->

Use the candidate's exit story from `config/profile.yml` to frame ALL content:
- **In PDF Summaries:** Bridge from past to future
- **In STAR stories:** Reference proof points from article-digest.md
- **In Draft Answers:** The transition narrative appears in the first response

## Your Cross-cutting Advantage

<!-- What's your "signature move"? What do you do that others can't? -->

Frame profile as **"Technical builder with real-world proof"** that adapts framing to the role.

## Your Portfolio / Demo

<!-- If you have a live demo, dashboard, or public project:
     url: https://yoursite.dev/demo
     password: demo-2026
     when_to_share: "LLMOps, AI Platform roles" -->

If you have a live demo/dashboard (check profile.yml), offer access in applications for relevant roles.

## Your Comp Targets

<!-- Research comp ranges for YOUR target roles -->

**General guidance:**
- Use WebSearch for current market data (Glassdoor, Levels.fyi, Blind)
- Frame by role title, not by skills
- Contractor rates are typically 30-50% higher than employee base

## Your Negotiation Scripts

<!-- Adapt to YOUR situation, currency, location -->

**Salary expectations:**
> "Based on market data for this role, I'm targeting [RANGE from profile.yml]. I'm flexible on structure -- what matters is the total package and the opportunity."

**Geographic discount pushback:**
> "The roles I'm competitive for are output-based, not location-based. My track record doesn't change based on postal code."

**When offered below target:**
> "I'm comparing with opportunities in the [higher range]. I'm drawn to [company] because of [reason]. Can we explore [target]?"

## Your Location Policy

<!-- Adapt to YOUR situation -->

**In forms:**
- Follow your actual availability from profile.yml
- Specify timezone overlap in free-text fields

**In evaluations (scoring):**
- Remote dimension for hybrid outside your country: score **3.0** (not 1.0)
- Only score 1.0 if JD says "must be on-site 4-5 days/week, no exceptions"
