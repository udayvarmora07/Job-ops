I'll evaluate this job posting. However, I notice the job description provided is incomplete — it only contains the role title, company name, and URL, but no actual job description text (responsibilities, requirements, qualifications, etc.).

Since I don't have access to Playwright or WebSearch in this session, I cannot fetch the JD from the LinkedIn URL. Let me proceed with what I can responsibly evaluate, drawing on general knowledge of Tarana Wireless and the "Cloud DevOps Engineer" role title, while being transparent about the limitations.

⚠️ **Important caveat:** The evaluation below is based on the role title, company, and my training-data knowledge of Tarana Wireless. It is NOT based on the actual job description text, which was not provided. Several blocks (especially B, F, G) would change materially once the real JD is available. Treat this as a preliminary assessment.

---

# Evaluation: Tarana Wireless — Cloud DevOps Engineer

**Date:** 2026-06-27
**URL:** https://www.linkedin.com/jobs/view/4429974168/
**Archetype:** AI Platform / LLMOps — N/A. Mapped to user's DevOps Engineer / Cloud Engineer archetype
**Score:** 3.7/5 (preliminary — no JD text)
**Legitimacy:** Proceed with Caution

---

## Step 0 — Archetype Detection

The jobops default archetypes (AI Platform, Agentic, etc.) do not apply here — this is a classic infrastructure role. Mapping to the user's own archetypes from `_profile.md`:

- **Primary:** Cloud Engineer (AWS) + DevOps Engineer (hybrid)
- **Secondary:** Site Reliability Engineer

The "Cloud DevOps Engineer" title at a hardware/wireless company (Tarana builds fixed-wireless access hardware + a cloud management plane, Tarana Cloud Suite) typically combines AWS infrastructure, CI/CD, and reliability for a SaaS control plane.

---

## A) Role Summary

| Field | Value |
|-------|-------|
| Archetype (user) | Cloud Engineer (AWS) + DevOps Engineer hybrid |
| Domain | Cloud platform / infrastructure for wireless device management (Tarana Cloud Suite) |
| Function | Build + operate |
| Seniority | Likely Mid (title carries no junior/senior qualifier; assume Mid until JD confirms) |
| Remote | Unknown — Tarana is HQ'd in Milpitas, CA, with an India engineering center in **Pune**. Possible India onsite/hybrid. |
| Team size | Unknown |
| TL;DR | Build and operate AWS-based cloud infrastructure and CI/CD for Tarana's network-management platform. |

**Note:** Tarana Wireless has a significant engineering presence in **Pune, India** — relevant to the candidate's location flexibility (Pune is in his onsite list).

---

## B) Match with CV

⚠️ Requirements below are **inferred from the role title and typical Cloud DevOps JDs**, not the actual posting. Verify against real JD.

| Likely JD Requirement | CV Evidence | Match |
|----------------------|-------------|-------|
| AWS infrastructure (EC2, EKS, VPC, S3, RDS) | "Provisioned multi-environment AWS infrastructure… EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch" | ✅ Strong |
| CI/CD pipelines | "Designed and maintained 40+ CI/CD pipelines using Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline" | ✅ Strong |
| Terraform / IaC | "Terraform IaC (34 reusable modules, S3 remote state, DynamoDB locking)" | ✅ Strong |
| Kubernetes | "Operated Kubernetes (EKS, OpenShift)… ArgoCD GitOps, Helm, Istio… 99.9% uptime" | ✅ Strong |
| Observability / monitoring | "Prometheus, Grafana, Loki, ELK Stack, Datadog" | ✅ Strong |
| Linux administration | "Linux (Ubuntu, Amazon Linux, RHEL), System Administration" | ✅ Strong |
| Scripting (Python/Bash) | "Developed Python and Bash automation to eliminate ~70% of recurring operational toil" | ✅ Strong |
| Incident response / RCA | "Drove root-cause analysis for Linux-based production incidents" | ✅ Good |
| Security/secrets | "HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS" | ✅ Good |

**Gaps (likely / to verify against real JD):**

1. **Seniority / years of experience** — Candidate has ~1+ year. If JD asks for 3–5+ years, this is a **potential hard blocker** for a Mid role.
   - *Mitigation:* Lead with depth-over-tenure framing — 40+ pipelines, 99.9% uptime, multi-region DR, EKS v1.33→v1.34 upgrade. These are above-junior accomplishments. Apply if JD says 2–3 years; deprioritize if it says 5+.

2. **Networking depth** — Tarana is a wireless networking company; JD may emphasize networking fundamentals (BGP, low-level networking) beyond standard cloud VPC work.
   - *Mitigation:* Adjacent — candidate has VPC isolation, Ingress-NGINX, Istio service mesh experience. Frame as cloud-networking competence; flag deeper protocol knowledge as a learning area.

3. **Scale of production data/IoT/device telemetry** — Tarana manages large fleets of wireless radios; high-volume telemetry pipelines may be in scope.
   - *Mitigation:* Point to observability stack (Loki/ELK/Datadog) and Loki + Grafana Alloy log-pipeline migration as adjacent evidence.

**Until the real JD is read, gaps 1–3 cannot be confirmed.**

---

## C) Level and Strategy

- **Level detected:** Unknown — title alone. Assume **Mid** as the modal interpretation of "Cloud DevOps Engineer."
- **Candidate's natural level:** Junior-to-Mid (per profile.yml; ~1+ yr but high accomplishment density).

**Sell senior-of-your-band without lying:**
- Lead with **scope, not tenure**: "Built and ran 40+ CI/CD pipelines across 20+ microservices," "sustained 99.9% uptime across multi-AZ EKS," "designed multi-region DR with RPO < 1 hour."
- Highlight the **Intern → full-time in 5 months** promotion as a velocity/ownership signal.
- Position the **EKS v1.33 → v1.34 zero-downtime cluster upgrade** as senior-level operational risk management.

**If they downlevel me:**
- Accept a Junior/Associate title if comp is fair; negotiate a **6-month review** with explicit promotion criteria (own a service end-to-end, lead an incident bridge).
- Use the negotiation script from `_profile.md`.

---

## D) Comp and Demand

⚠️ Estimates from training data — not live market data. Verify on Levels.fyi / Glassdoor / AmbitionBox.

| Item | Estimate | Notes |
|------|----------|-------|
| Cloud DevOps Engineer, Mid, India (Pune/Bangalore) | ₹10–20 LPA base | Range widens for product companies; Tarana is a funded US product company, likely upper half |
| Junior (1–2 yr) DevOps, India | ₹6–12 LPA | Candidate's tenure band |
| Tarana comp reputation | Likely competitive | Well-funded (raised significant Series rounds); US product companies in India typically pay above local-services rates like eSparkBiz |
| Demand trend | High | Cloud/DevOps remains a strong, persistent demand category in India |

**Guidance:** Tarana as a US-funded product company should pay meaningfully above a services firm. Even if downleveled, the comp jump from a services background is likely favorable. Set expectations using AmbitionBox/Levels.fyi data before any number conversation.

---

## E) Customization Plan

| # | Section | Current status | Proposed change | Why |
|---|---------|---------------|-----------------|-----|
| 1 | Summary | "DevOps Engineer with 1+ year…" | Add AWS-cloud-platform emphasis; lead with EKS + AWS depth | Role is "Cloud DevOps" — front-load cloud |
| 2 | Skills | Broad list | Reorder to put AWS services + Terraform + EKS first | Mirror likely JD keywords |
| 3 | Projects | CRM EKS project listed 3rd | Promote Cloud-Native SaaS CRM (EKS) to top | Strongest cloud-platform proof |
| 4 | Experience bullet | DR + uptime bullets present | Surface 99.9% uptime + multi-region DR near top | Signals reliability for a SaaS control plane |
| 5 | Location | Ahmedabad | State Pune availability explicitly | Tarana has a Pune center |

**Top 5 LinkedIn changes:**
1. Headline → "Cloud / DevOps Engineer — AWS, EKS, Terraform, CI/CD."
2. About → lead with AWS infra + reliability metrics.
3. Add Pune to "Open to work" locations.
4. Pin the EKS/CRM project to featured.
5. Add skills: AWS, Terraform, Kubernetes, CI/CD, Prometheus for recruiter search.

---

## F) Interview Plan

⚠️ Stories mapped to **inferred** requirements. Refine once JD is available.

| # | JD Requirement (inferred) | STAR+R Story | S | T | A | R | Reflection |
|---|---------------------------|--------------|---|---|---|---|------------|
| 1 | CI/CD at scale | 40+ pipelines build-out | Manual 45-min releases across 20+ services | Automate end-to-end | Built Jenkins/GitLab/GHA/CodePipeline workflows | Cut release to <8 min (82%) | Standardizing pipeline templates earlier would have saved rework |
| 2 | AWS IaC | Terraform module library | Slow, drift-prone provisioning | Reproducible multi-env infra | 34 modules, S3 state, DynamoDB lock | 80% faster provisioning, 95% less drift | Remote state + locking is non-negotiable from day 1 |
| 3 | Kubernetes ops | EKS upgrade v1.33→v1.34 | Cluster on deprecated APIs | Zero-downtime upgrade | Node group rollout, add-on compat, API remediation | No downtime | Test API deprecations in staging before prod |
| 4 | Reliability / uptime | Multi-AZ EKS operations | Multi-AZ workloads needing HA | Sustain SLA | ArgoCD, Karpenter, KEDA, Istio | 99.9% uptime | Autoscaling tuning matters as much as redundancy |
| 5 | Cost optimization | Karpenter/KEDA savings | High compute spend | Cut cost without risk | Spot/On-Demand diversification, off-hours scale-down | 30% / $500+/mo saved | Track cost as a first-class SLO |
| 6 | DR / resilience | Velero multi-region DR | No tested recovery path | RPO target | Velero + EBS Data Mover, cross-region S3/ECR, AWS Backup | RPO < 1 hr | Untested backups are not backups — schedule restore drills |
| 7 | Incident response | Linux production RCA | Recurring prod incidents | Reduce MTTR | RCA across CPU/mem/net/runtime, runbooks, post-mortems | Faster, repeatable resolution | Runbooks turn heroics into process |
| 8 | Observability | Prometheus/Grafana/Loki stack | Limited visibility | Full-stack observability | Prometheus, Grafana, Loki, ELK, Datadog; Alloy migration | Reliable log/metric pipeline | Pick one log standard early to avoid migration debt |

**Recommended case study:** Cloud-Native SaaS CRM (Multi-Tenant AWS/EKS) — closest analog to a SaaS control plane; covers IaC, EKS upgrades, cost, and DR in one narrative.

**Red-flag questions to prepare:**
- *"Only ~1 year of experience?"* → "Yes, but unusually dense: 40+ pipelines, multi-region DR, a zero-downtime EKS major-version upgrade, and promotion from intern in 5 months."
- *"Why leave eSparkBiz?"* → Growth into a product-company environment with larger-scale infrastructure ownership.
- *"Networking depth for a wireless company?"* → Honest: strong on cloud networking (VPC, Istio, Ingress); eager to deepen on protocol-level networking.

---

## G) Posting Legitimacy

**Assessment: Proceed with Caution** — primarily because **no JD text and no live page data were available** in this session, not because of negative signals.

| Signal | Finding | Weight |
|--------|---------|--------|
| Posting freshness | Could not check (no Playwright/page access) | Neutral |
| Apply button state | Could not verify | Neutral |
| Tech specificity | JD text not provided — cannot assess | Neutral |
| Requirements realism | Cannot assess without JD | Neutral |
| Layoff / freeze news | Not searchable this session | Neutral |
| Reposting pattern | No scan-history available | Neutral |
| Company legitimacy | Tarana Wireless is a real, funded fixed-wireless company with a US HQ and a Pune engineering center | Positive |
| Role-company fit | A Cloud DevOps role fits a company running a SaaS network-management platform | Positive |

**Context notes:**
- The only concrete positive is that **Tarana is a real, established company** and the role type fits its business.
- Default of "Proceed with Caution" applies per the no-data rule — never "Suspicious" without evidence.
- **Action for user:** Open the LinkedIn link, confirm it's still active, read the real JD, and re-run this evaluation with the full text so Blocks B, D, F, and G can be made concrete.

---

## Keywords extracted (from title + company context — verify against real JD)
Cloud DevOps Engineer, AWS, EKS, Kubernetes, Terraform, CI/CD, Jenkins, GitLab CI, GitHub Actions, Docker, Prometheus, Grafana, observability, IaC, Linux, Python, Bash, reliability, disaster recovery, autoscaling, Tarana Cloud Suite

---

**Score rationale (preliminary):** Strong CV-to-role-type alignment (skills match is excellent) and good North Star fit pull this up; the seniority/tenure gap, missing comp confirmation, and — most importantly — the absence of an actual JD pull it down. **3.7/5** reflects a likely good-but-unconfirmed match. **Please re-run with the full JD text for an accurate score.**

---SCORE_SUMMARY---
COMPANY: Tarana Wireless
ROLE: Cloud DevOps Engineer
SCORE: 3.7
ARCHETYPE: Cloud Engineer (AWS) + DevOps Engineer hybrid
LEGITIMACY: Proceed with Caution
---END_SUMMARY---