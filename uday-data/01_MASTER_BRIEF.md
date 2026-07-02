# Uday Varmora — Master Resume Brief (Source of Truth)

> **For Claude (or any AI):** This is the ONLY source of facts you may use when tailoring my resume. Never invent metrics, tools, projects, or claims that aren't here. If a JD asks for something not in this brief, mark it as a gap rather than fabricate.

> **SCOPE NOTE (read once):** Uday **joined the CRM and Salon projects as existing, already-deployed systems** and has **maintained and extended them in depth** — so the technical work and metrics below are his real, defensible contributions (monitoring, cost optimization, EKS upgrades, DR, CI/CD, automation). The only honesty rule: **do NOT claim he originally architected/deployed the platform itself.** Use verbs like *operated, maintained, extended, optimized, upgraded, built* for his contributions — not *architected the platform from scratch*. The **Healthcare project was a prototype** co-built with a colleague for client review and handed off — keep its claims at prototype scale (see section 5).

---

## 1. Identity & Contact (NEVER CHANGES)

- **Name:** UDAY VARMORA
- **Phone:** +91 96623 85170
- **Email:** varmorauday1045@gmail.com
- **LinkedIn:** linkedin.com/in/udayvarmora (plain text + hyperlink)   ← corrected (was uday-varmora)
- **GitHub:** github.com/udayvarmora07 (plain text + hyperlink)   ← corrected (was uday-varmora)
- **Location:** Ahmedabad, India

## 2. Experience Facts (NEVER CHANGES)

- **Total experience:** 1+ year (NEVER state as "1.5 years" or specific months)
- **Current role:** DevOps Engineer at eSparkBiz Technologies, Ahmedabad
- **Tenure:** Jan 2025 – May 2025 (Intern) → Jun 2025 – Apr 2026 (full-time, promoted within 5 months)
- **Current status:** Not currently employed. Last working day: 30 April 2026. Available as immediate joiner.
- **Education:** B.Tech, Information Technology — Dharmsinh Desai University, Gujarat, India, 2021–2025, CGPA 7.25/10
- **Achievement:** "Student of the Year" in Class 10
- **Certifications:** Uday does **NOT** hold AWS Cloud Practitioner (earlier entry was wrong — must never appear). Only valid entry: **"AWS Certified Solutions Architect – Associate (In Progress)."** CKA is a stated goal. **Default: omit Certifications section** unless JD specifically asks; if asked, list only SAA (In Progress).

## 3. Anchor Metrics (THE ONLY METRICS YOU MAY USE)

These are real, defensible numbers from his maintain/extend work. Never invent others.

| Metric | Value | Where it lives |
|--------|-------|----------------|
| Uptime SLA | 99.9% | Multi-AZ K8s clusters (CRM project, operated/maintained) |
| Release cycle time | ~8 min automated deploys (maintained state) | CI/CD pipelines — claim as a state he sustains; **do NOT claim "82% / 45→8 min reduction"** (that improvement predates him) |
| Terraform provisioning | Reproducible multi-env (34 modules) | IaC he maintains/extends; **do NOT claim "80% faster / 95% drift reduction"** (original build, not his improvement) |
| Operational toil reduction | ~70% | Python/Bash automation |
| Compute cost reduction | 30% ($500+/month) | Karpenter Spot + KEDA scale-down + non-prod CronJob (his cost work) |
| Non-prod cost scheduling | Kubernetes CronJob | CRM — scales dev/non-prod down overnight, up each morning (his work) |
| RPO (disaster recovery) | < 1 hour | Multi-region DR (CRM project — built on the platform) |
| EKS cluster upgrade | v1.33 → v1.34 | CRM project (zero-downtime, his work — NEVER change versions) |
| Microservices on platform | 20+ | CRM project (corrected back to 20+) |
| CI/CD pipelines | 40+ | Built/maintained across Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, CodeBuild |
| Lambda functions | 30+ | Salon SaaS (maintained/extended) |
| SAM/CloudFormation templates | 6 nested | Salon SaaS (maintained/extended) |
| Build time reduction | 60%+ | EFS-mounted Python dependency layer (Salon SaaS) — ✅ his engineering: existing system used Lambda layers; hit the 250MB SAM build limit; he solved it by switching to an EFS-mounted shared dependency layer |
| Terraform modules | 34 reusable | Current role IaC |
| Promotion timeline | Full-time within 5 months | Intern → full-time |

> ⚠ **Prototype-scale — confirm before use (Healthcare project only):** "500+ concurrent users," "5+ overly permissive IAM roles removed," and "~30% image pull latency reduction" were tied to the Healthcare system. Since that was a **prototype handed off after client review** (not a production system you operated), these production-scale outcomes are hard to defend in interview. Keep them out by default; restore only if the metric is genuinely real and you can defend it.

## 4. Tech Stack — What I Can Defensibly Claim

### TIER 1 — Deep production experience (lead with these)
- **AWS:** EKS, EC2, Lambda, S3, ECR, RDS (Aurora PostgreSQL), VPC, IAM (IRSA, Pod Identity), KMS, Secrets Manager, CloudWatch, CloudFormation, SAM, CodePipeline, CodeBuild, CloudFront, App Runner, X-Ray, EFS, DynamoDB
- **Containers/K8s:** Docker, Kubernetes (EKS), Helm, ArgoCD, Karpenter, KEDA, Ingress-NGINX Controller
- **IaC & Config:** Terraform (34 modules, S3 remote state, DynamoDB locking), Ansible (production-level, deep hands-on), AWS CloudFormation, AWS SAM
- **CI/CD:** Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild
- **Observability (CRM project):** Prometheus, Grafana, Loki, Grafana Alloy, CloudWatch
- **Languages:** Python, Bash/Shell
- **OS:** Linux (Ubuntu, Amazon Linux, RHEL), System Administration
- **Security:** HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM least-privilege
- **VCS:** Git, GitHub, Bitbucket

### TIER 2 — Exposure but not deep production (include only if JD asks)
- **OpenShift** — used in environment, not lead operator
- **Istio service mesh** — installed and configured, not deep traffic engineering
- **Velero** — used for DR on the platform
- **ELK Stack** — installed and queried, not architected
- **Datadog** — basic monitoring setup, not deep instrumentation
- **PagerDuty** — alerts routing, not on-call rotation owner
- **SonarQube** — integrated into pipelines, not custom rules
- **Kong API Gateway / AWS CDK** — light exposure

### TIER 2 (continued) — Azure (Fundamentals)
- **Azure** — fundamentals knowledge only, NO production work. Use "Azure (Fundamentals)" framing only. Apply the gate below before every resume — do NOT add by default.

**Azure inclusion gate (check all three before adding):**

1. **JD signal** — does the JD mention Azure, multi-cloud, or cloud-agnostic? If yes → include. If the JD is AWS-only with no multi-cloud mention → skip.

2. **Company signal** — research the company before deciding:
   - Large enterprise / MNC / BFSI / consulting firm (TCS, Infosys, Wipro, Accenture, Capgemini, Big4, banks) → include even if JD doesn't explicitly say Azure; these orgs run hybrid/multi-cloud and it boosts shortlisting.
   - Mid-size product company or SaaS startup with clear AWS-first stack → skip unless JD mentions it.
   - Small startup / early-stage / bootstrapped → skip; adds noise, signals unfocused.
   - Company uses Azure as primary cloud → near-miss role; flag as gap, don't fake depth.

3. **Role signal** — Cloud Engineer / Solutions Architect / Infrastructure Engineer roles benefit more from multi-cloud breadth than pure DevOps / SRE / Platform roles. For SRE-titled roles, skip unless JD explicitly says multi-cloud.

**Decision summary:**
- ✅ Add → JD mentions multi-cloud OR large enterprise/MNC + Cloud/Infra role title
- ❌ Skip → AWS-only JD + startup/product company + DevOps/SRE title
- ❓ When in doubt → skip; one extra skill item doesn't offset the "why is this here?" question from a focused recruiter

### TIER 2 (continued) — Red Hat Linux / RHEL explicit surfacing
- **Red Hat Linux (RHEL)** — already present in Tier 1 as part of `Linux (Ubuntu, Amazon Linux, RHEL)`. The question per resume is not "do I know it" (you do) but "should I surface Red Hat explicitly and prominently." Apply the gate below.

**Why this matters:** RHEL in a Linux list is a quiet signal. Surfacing "Red Hat Linux" as a named item — or adding OpenShift alongside it — sends a loud signal to enterprise/on-prem/hybrid recruiters who keyword-scan for it. But for cloud-native AWS shops it reads as irrelevant noise.

**Red Hat inclusion gate (check all three before surfacing):**

1. **JD signal** — does the JD explicitly mention Red Hat, RHEL, Red Hat Enterprise Linux, or OpenShift? If yes → surface RHEL prominently (move it first in the Linux row or give it its own skill row) and consider adding OpenShift (Tier 2) alongside. If no mention → keep RHEL quietly inside the Linux row as-is, don't call it out.

2. **Company signal** — research the company type before deciding:
   - Large enterprise / MNC / BFSI / telecom / government / PSU / on-prem-heavy IT (Tata, Reliance, HCL, Wipro, TCS infra teams, banks, defence contractors) → surface RHEL explicitly even if JD doesn't say it — these environments run RHEL as standard and recruiters expect to see it; it boosts shortlisting.
   - Mid-size product company or SaaS with cloud-native AWS/GCP stack → keep RHEL quiet inside the Linux row; calling it out signals "on-prem background" which can hurt for cloud-native roles.
   - Red Hat partner / reseller / consulting firm → surface it prominently; they actively value the signal.
   - Small startup / cloud-first → skip surfacing; adds noise.

3. **Role signal** — Infrastructure Engineer / Linux Admin / Systems Engineer / DevOps at enterprise shops → surface RHEL. Cloud Engineer / SRE / Platform Engineer at product companies → keep quiet. The more on-prem/hybrid the role, the stronger the signal.

**What "surface RHEL" means in practice:**
- In the Skills section: either reorder the OS row as `Linux (RHEL, Ubuntu, Amazon Linux)` (putting RHEL first), or break it into its own row: `OS & Linux: Red Hat Enterprise Linux (RHEL), Ubuntu, Amazon Linux, System Administration`
- If OpenShift is also in the JD, add it to Containers row (it's already Tier 2)
- Never write "Red Hat Certified" or imply certification — you don't hold one

**Decision summary:**
- ✅ Surface RHEL prominently → JD says Red Hat/RHEL/OpenShift OR large enterprise/on-prem-heavy company + Infra/Linux/DevOps role
- ✅ Add OpenShift alongside → JD explicitly mentions OpenShift OR Red Hat partner company
- ❌ Keep RHEL quietly in Linux row → cloud-native AWS startup + Cloud/SRE/Platform role + no JD mention
- ❓ When in doubt → keep it quiet; RHEL is already there, you're not hiding it, you're just not leading with it

### NEVER CLAIM (NOT IN INVENTORY)
- Go programming; GCP / Google Cloud; Chaos engineering (Chaos Monkey/Gremlin); formal Production Readiness Reviews; error-budget policy governance; game days / failure injection; Service Catalog / Backstage; distributed tracing beyond X-Ray (Jaeger, OpenTelemetry); ML/AI infrastructure; mobile dev; frontend frameworks (React/Vue/Angular)

## 5. Project Inventory

> Honest framing: CRM & Salon were **existing systems he maintained and extended in depth**; Healthcare was a **prototype**. Bullets describe his real contributions. Avoid only "architected/deployed the platform from scratch."

### Project 1: Cloud-Native SaaS CRM Platform (Jun 2025 – Apr 2026)
**One-line summary:** Maintained and extended a multi-tenant AWS / EKS platform (~20+ microservices) — joined as an existing production system; drove operations, cost optimization, reliability, and upgrades through Apr 2026.

**Universal tech stack (single line):**
`Terraform · AWS EKS · Docker · Jenkins · GitLab CI/CD · GitHub Actions · AWS CodePipeline · ArgoCD · Ingress-NGINX · Prometheus · Grafana`

**Defensible bullets (use 2-3 based on role):**
1. **Operations & upgrade:** Operated and extended a multi-environment AWS/EKS platform with per-environment VPC isolation, S3/DynamoDB remote state, and Ingress-NGINX Controller on Linux-based EKS nodes; **executed a zero-downtime EKS cluster upgrade (v1.33 → v1.34)** — managing node group rollouts, add-on compatibility, and API deprecation remediation.
2. **Cost optimization:** Reduced compute costs by **30% ($500+/month)** via Karpenter Spot/On-Demand diversification, KEDA off-hours scale-down, and a **Kubernetes CronJob that scales dev/non-prod down overnight and back up each morning**; migrated deprecated loki-stack to Loki + Grafana Alloy.
3. **Disaster recovery:** Built a multi-region disaster recovery strategy using Velero (with EBS snapshot Data Mover), S3/ECR cross-region replication, and AWS Backup with cross-region vaults — achieving **RPO < 1 hour**.
4. **Observability (optional 4th):** Set up and maintained monitoring with Prometheus, Grafana, Loki, and Grafana Alloy — dashboards, metrics, and log pipelines across the platform's microservices.

### Project 2: Serverless Backend — Multi-Tenant Salon Management SaaS (2024)
**One-line summary:** Maintained and extended an existing serverless backend (30+ Lambda functions, 6 nested SAM templates).

**Universal tech stack:**
`AWS Lambda · SAM · CloudFormation · API Gateway · RDS PostgreSQL · Amazon EFS · Secrets Manager · Python`

**Defensible bullets:**
1. **Serverless operations:** Maintained and extended a serverless build/deploy system of **6 nested SAM/CloudFormation templates** and **30+ Python Lambda functions** — handling deployments, reproducible packaging, and per-function least-privilege IAM.
2. **EFS layer:** Hit SAM build limits (Lambda layer size exceeding 250MB); engineered a solution by switching to a shared **EFS-mounted Python dependency layer** across 30+ functions — eliminating the packaging bottleneck and cutting build times by **60%+**.

### Project 3: Healthcare Management System — Prototype / PoC (2024)
**One-line summary:** Co-built a proof-of-concept with a colleague to demonstrate an architecture for client review; handed off after the prototype phase. **Not a production system.**

**Universal tech stack:**
`AWS S3 · CloudFront · App Runner · ECR · Docker · GitHub Actions · GHCR · Secrets Manager · IAM`

**Defensible bullets:**
1. **Prototype architecture:** Co-built a split-hosting prototype (S3/CloudFront frontend, Dockerised App Runner backend) with a **dual-registry GHCR/ECR strategy** — demonstrating zero-downtime redeployment for client review.
2. **Release automation:** Built the release workflow via **GitHub Actions** — Docker build, ECR/GHCR dual-push, S3 sync, CloudFront invalidation, and App Runner deploy — with least-privilege IAM scoping.

> ⚠ Do not attach production-scale outcomes ("500+ users," "removed 5+ IAM roles," "30% latency reduction") to this project unless the metric is genuinely real and defensible — it was a prototype.

## 6. Experience Bullet Library (Master List)

Pick 5-6 bullets per resume. Reframe verbs to match JD tone, but keep contribution-level (operate/extend/build), not platform-origination, framing.

### B1 — CI/CD pipelines
"Built and maintained 40+ CI/CD pipelines using Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, and AWS CodeBuild — automating build-test-deploy across 20+ Dockerised microservices, including pipelines for new services added to the platform; sustain fast, automated (~8-minute) deployments."
> Do NOT claim "cut release cycles 82% (45→8 min)" — that improvement predates Uday; "~8-minute deploys" is the state he sustains.

### B2 — Terraform IaC
"Maintained and extended multi-environment AWS infrastructure on Linux (Ubuntu, Amazon Linux, RHEL) using Terraform IaC (34 reusable modules, S3 remote state, DynamoDB locking) — delivering consistent, reproducible provisioning across Dev, Staging, and Production."
> Do NOT claim "80% faster / 95% drift reduction" — original build, not his improvement.

### B3 — Kubernetes/EKS operations
"Operated Kubernetes (EKS) clusters with ArgoCD GitOps, Helm, and Ingress-NGINX — managing zero-downtime rollouts, Karpenter node autoscaling, and KEDA event-driven scaling; executed a zero-downtime EKS upgrade (v1.33 → v1.34); sustained 99.9% uptime across multi-AZ clusters."
> Add "OpenShift" here only if JD explicitly asks — it is Tier 2 (used in environment, not lead operator).

### B4 — Linux RCA + Observability
"Drove root-cause analysis for Linux-based production incidents across CPU, memory, network, and container runtime; built observability with Prometheus, Grafana, and Loki; authored runbooks and post-incident reviews."
> Add "ELK Stack" and/or "Datadog" here only if JD explicitly asks — both are Tier 2 (installed/queried, not architected).

### B5 — Python/Bash automation + toil reduction
"Developed Python and Bash automation to eliminate ~70% of recurring operational toil — cluster operations, log triage, secret rotation, scheduled scaling (non-prod CronJob), and pipeline scripting."
> Add "SonarQube quality gates" here only if JD explicitly asks — it is Tier 2 (integrated into pipelines, not custom rules).

### B6 — Security & secrets
"Strengthened security with HashiCorp Vault and AWS Secrets Manager for centralized secret management, Sealed Secrets for GitOps-compatible K8s secrets, and Trivy Operator for continuous container vulnerability scanning; enforced least-privilege IAM via IRSA and Pod Identity."

### B7 — AWS architecture breadth (Cloud Engineer variant)
"Operated and extended production AWS infrastructure spanning EC2, EKS, Lambda, S3, RDS, VPC, IAM, and CloudWatch across multi-AZ deployments — supporting 20+ Dockerised microservices with 99.9% uptime."

### B8 — Cost optimization standalone (Cloud Engineer variant)
"Reduced AWS compute costs by 30% ($500+/month) through Karpenter Spot/On-Demand diversification, KEDA off-hours scale-down, and a non-prod scheduling CronJob — preserving production availability while improving cluster resource utilization."

### B9 — SRE-framed reliability
"Owned ongoing reliability for Kubernetes (EKS) clusters serving 20+ microservices — sustained 99.9% uptime SLA across multi-AZ deployments with continuous uptime monitoring."
> Add "OpenShift" here only if JD explicitly asks — it is Tier 2.

### B10 — SRE-framed incident response
"Drove incident response and root-cause analysis for Linux-based production incidents; authored blameless post-mortems and runbooks that reduced repeat-incident frequency and accelerated on-call response readiness."

### Intern bullets (use both, always)
- **I1:** "Built and maintained AWS infrastructure monitoring on Linux-based environments, configured CloudWatch dashboards, and triaged production incidents across Kubernetes workloads; authored operational runbooks for recurring issue patterns and root-cause analyses."
- **I2:** "Wrote Python and Bash automation scripts to streamline deployment workflows and reduce manual operational steps — demonstrated ownership and impact, earning full-time promotion within 5 months."

## 7. Tone Reframing by Role Type

| Role | Verbs | Frame |
|------|-------|-------|
| **Startup / SaaS** | Owned, Built, Extended, Shipped | Ownership + speed + breadth |
| **SRE** | Sustained, Drove, Authored, Eliminated | SLOs/MTTR/toil/runbooks/on-call |
| **Cloud Engineer** | Operated, Optimized, Provisioned, Upgraded | AWS depth + cost + reliability |
| **DevOps Engineer** | Built, Automated, Maintained, Operated | Pipelines + automation + uptime |
| **BFSI / Enterprise** | Governed, Standardized, Hardened | Governance/compliance/audit/least-privilege |
| **Platform Engineer** | Built, Enabled, Standardized | Internal platform + developer experience |

> Avoid implying you originally architected the platform — prefer *operated / extended / optimized / upgraded / built [specific component]*.

## 8. Format Rules (NEVER CHANGE)

- **Page:** Single page, US Letter (216 × 279 mm)
- **Font:** Calibri throughout
- **Body size:** 10pt · **Skills & contact:** 10pt · **Project tech stack:** 9.5pt italic dark gray
- **Name:** 16pt bold, centered · **Section headers:** 11pt bold with accent underline
- **Margins:** 25pt top + 25pt bottom, 0.5" left/right
- **Color schemes:** Teal `#1A7A7A` + gold `#C8A951` (startup/SaaS) · Navy `#1B3A6B` + slate gold `#B8942A` (enterprise/BFSI/Cloud/SRE — DEFAULT)
- **Skill row format:** Category (bold black) + items (regular), each row ONE line at 9.5pt
- **Bullets:** Action verb + context + quantified result; 1-2 lines each; mix bold key terms
- **URLs:** plain text format with hyperlinks underneath
- **British -ise spelling:** Dockerised, containerised
- **Sections (in order):** Header → Summary (3 lines max) → Technical Skills (8 rows) → Professional Experience → Key Projects → Education → Achievements
- **Education and Achievements:** ALWAYS separate sections
- **"Immediate joiner":** Only include if JD explicitly asks
- **Certifications:** Default = omit. Include only if JD asks (then SAA In Progress only).
