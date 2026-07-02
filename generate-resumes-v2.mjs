#!/usr/bin/env node
/**
 * generate-resumes-v2.mjs
 * Generates 20 single-page US Letter HTML resumes matching the uday-data spec exactly:
 *  - Font: Calibri (with system fallback)
 *  - US Letter (8.5in × 11in), single page, NO bottom gap
 *  - Navy #1B3A6B (enterprise) or Teal #0F766E (startup) accent
 *  - Sections: Header → Summary → Skills → Experience → Projects → Education → Achievements
 *  - Content stretches to fill the full page (no empty bottom space)
 *  - All metrics from 01_MASTER_BRIEF.md only (no invented data)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(__dirname, 'output'), { recursive: true });

// ─── CSS ENGINE ───────────────────────────────────────────────────────────────
function buildCSS(accent) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Calibri:wght@400;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      background: #fff;
    }

    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.25;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 8.5in;
      height: 11in;
      padding: 0.35in 0.5in 0.35in 0.5in;
      display: flex;
      flex-direction: column;
    }

    /* ── HEADER ── */
    .header { text-align: center; margin-bottom: 0.05in; }
    .header h1 {
      font-size: 16pt;
      font-weight: 700;
      color: ${accent};
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    .contact-line {
      font-size: 10pt;
      color: #444;
      margin-top: 3px;
      line-height: 1.3;
    }
    .contact-line a { color: #444; text-decoration: none; }

    /* ── SECTION HEADER ── */
    .section-header {
      font-size: 11pt;
      font-weight: 700;
      color: ${accent};
      text-transform: uppercase;
      border-bottom: 1.5px solid ${accent};
      padding-bottom: 1px;
      margin-top: 0.1in;
      margin-bottom: 4px;
      letter-spacing: 0.03em;
    }

    /* ── SUMMARY ── */
    .summary { font-size: 10pt; line-height: 1.35; color: #111; }
    .summary strong { font-weight: 700; }

    /* ── SKILLS ── */
    .skill-row { font-size: 10pt; line-height: 1.3; color: #111; margin-bottom: 1px; }
    .skill-row .cat { font-weight: 700; color: #000; }

    /* ── EXPERIENCE ── */
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 10pt;
      margin-top: 7px;
      margin-bottom: 1px;
    }
    .job-header:first-of-type { margin-top: 2px; }
    .job-left { font-weight: 700; color: #000; }
    .job-left .org { font-weight: 400; color: #444; }
    .job-right { font-weight: 700; color: #000; white-space: nowrap; font-size: 9.5pt; }
    .job-bullets { padding-left: 0.18in; margin-top: 1px; }
    .job-bullets li {
      font-size: 10pt;
      line-height: 1.3;
      color: #111;
      margin-bottom: 1px;
      list-style: disc;
    }
    .job-bullets li strong { font-weight: 700; }

    /* ── PROJECTS ── */
    .project { margin-top: 6px; }
    .project-title { font-size: 10pt; font-weight: 700; color: #000; line-height: 1.2; }
    .project-tech { font-size: 9.5pt; font-style: italic; color: #444; margin-top: 1px; margin-bottom: 1px; }
    .project-bullets { padding-left: 0.18in; }
    .project-bullets li {
      font-size: 10pt;
      line-height: 1.3;
      color: #111;
      margin-bottom: 1px;
      list-style: disc;
    }
    .project-bullets li strong { font-weight: 700; }

    /* ── EDUCATION ── */
    .edu-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 10pt;
      margin-top: 2px;
    }
    .edu-left { color: #111; }
    .edu-left strong { font-weight: 700; }
    .edu-right { font-weight: 700; white-space: nowrap; font-size: 9.5pt; }

    /* ── ACHIEVEMENTS ── */
    .achievements-bullets { padding-left: 0.18in; margin-top: 2px; }
    .achievements-bullets li {
      font-size: 10pt;
      line-height: 1.3;
      color: #111;
      list-style: disc;
    }
    .achievements-bullets li strong { font-weight: 700; }

    /* ── SPACER fills remaining vertical space ── */
    .flex-spacer { flex: 1; }

    /* ── PRINT ── */
    @media print {
      html, body { width: 8.5in; height: 11in; }
      .page { padding: 0.35in 0.5in; }
    }
  `;
}

// ─── HTML BUILDER ─────────────────────────────────────────────────────────────
function bold(text) {
  // Convert **text** to <strong>text</strong>
  return String(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function buildHTML({ slug, title, accent = '#1B3A6B', summary, skills, expBullets, internBullets, projects }) {
  const css = buildCSS(accent);

  const skillRows = skills.map(([cat, items]) =>
    `<div class="skill-row"><span class="cat">${cat}:</span> ${items}</div>`
  ).join('\n        ');

  const expBulletsHTML = expBullets.map(b => `<li>${bold(b)}</li>`).join('\n            ');
  const internHTML = internBullets.map(b => `<li>${bold(b)}</li>`).join('\n            ');

  const projectsHTML = projects.map(proj => `
        <div class="project">
          <div class="project-title">${proj.title}</div>
          <div class="project-tech">${proj.tech}</div>
          <ul class="project-bullets">
            ${proj.bullets.map(b => `<li>${bold(b)}</li>`).join('\n            ')}
          </ul>
        </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UDAY VARMORA — ${title}</title>
<style>${css}</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <h1>UDAY VARMORA</h1>
    <div class="contact-line">
      +91 96623 85170 &nbsp;|&nbsp;
      <a href="mailto:varmorauday1045@gmail.com">varmorauday1045@gmail.com</a> &nbsp;|&nbsp;
      <a href="https://linkedin.com/in/udayvarmora">linkedin.com/in/udayvarmora</a> &nbsp;|&nbsp;
      <a href="https://github.com/udayvarmora07">github.com/udayvarmora07</a> &nbsp;|&nbsp;
      Ahmedabad, India
    </div>
  </div>

  <!-- PROFESSIONAL SUMMARY -->
  <div class="section-header">Professional Summary</div>
  <div class="summary">${bold(summary)}</div>

  <!-- TECHNICAL SKILLS -->
  <div class="section-header">Technical Skills</div>
  <div class="skills-section">
    ${skillRows}
  </div>

  <!-- PROFESSIONAL EXPERIENCE -->
  <div class="section-header">Professional Experience</div>

  <div class="job-header">
    <span class="job-left">DevOps Engineer &nbsp;<span class="org">|&nbsp; eSparkBiz · Ahmedabad, India</span></span>
    <span class="job-right">Jun 2025 – Apr 2026</span>
  </div>
  <ul class="job-bullets">
    ${expBulletsHTML}
  </ul>

  <div class="job-header">
    <span class="job-left">DevOps Engineer Intern &nbsp;<span class="org">|&nbsp; eSparkBiz · Ahmedabad, India</span></span>
    <span class="job-right">Jan 2025 – May 2025</span>
  </div>
  <ul class="job-bullets">
    ${internHTML}
  </ul>

  <!-- KEY PROJECTS -->
  <div class="section-header">Key Projects</div>
  ${projectsHTML}

  <!-- EDUCATION -->
  <div class="section-header">Education</div>
  <div class="edu-row">
    <span class="edu-left"><strong>B.Tech, Information Technology</strong> — Dharmsinh Desai University, Gujarat, India &nbsp;|&nbsp; CGPA: 7.25 / 10</span>
    <span class="edu-right">2021 – 2025</span>
  </div>

  <!-- ACHIEVEMENTS -->
  <div class="section-header">Achievements</div>
  <ul class="achievements-bullets">
    <li>Awarded <strong>"Student of the Year"</strong> in Class 10 for outstanding academic performance and leadership contributions.</li>
  </ul>

  <!-- FLEX SPACER — pushes content to fill the page -->
  <div class="flex-spacer"></div>

</div>
</body>
</html>`;
}

// ─── MASTER CONTENT LIBRARY (from 01_MASTER_BRIEF.md) ───────────────────────

// Bullet bank — exact text from MASTER BRIEF
const B = {
  B1: 'Designed and maintained **40+ CI/CD pipelines** using **Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, and AWS CodeBuild** — automating build-test-deploy workflows across **20+ Dockerised microservices**, cutting release cycles by **82% (45 → 8 min)** with zero manual intervention.',
  B2: 'Provisioned multi-environment AWS infrastructure on **Linux (Ubuntu, Amazon Linux, RHEL)** using **Terraform IaC** (34 reusable modules, S3 remote state, DynamoDB locking) — reducing provisioning time by **80%** and configuration drift by **95%** across Dev, Staging, and Production environments.',
  B3: 'Operated **Kubernetes (EKS, OpenShift)** clusters with **ArgoCD GitOps, Helm, Istio service mesh, and Ingress-NGINX Controller** — managing zero-downtime rollouts, Karpenter node autoscaling, and KEDA event-driven scaling; sustained **99.9% uptime** across multi-AZ clusters.',
  B4: 'Drove **root-cause analysis** for **Linux-based production incidents** across CPU, memory, network, and container runtime; built observability with **Prometheus, Grafana, Loki, ELK Stack, and Datadog**; authored runbooks and post-incident reviews.',
  B5: 'Developed **Python and Bash** automation to eliminate **~70% of recurring operational toil** — covering cluster operations, log triage, secret rotation, and pipeline scripting; integrated SonarQube quality gates and **Git** code-review workflows into CI/CD.',
  B6: 'Strengthened security posture with **HashiCorp Vault** and **AWS Secrets Manager** for centralised secret management, **Sealed Secrets** for GitOps-compatible K8s secrets, and **Trivy Operator** for continuous container vulnerability scanning; enforced least-privilege IAM via IRSA.',
  B7: 'Architected and operated production AWS infrastructure spanning **EC2, EKS, Lambda, S3, RDS, VPC, IAM, and CloudWatch** across multi-AZ deployments — supporting 20+ Dockerised microservices with **99.9% uptime**.',
  B8: 'Reduced AWS compute costs by **30% ($500+/month)** through Karpenter Spot/On-Demand diversification, KEDA off-hours scale-down, and right-sized cluster capacity — preserving production availability while improving resource utilisation across 20+ services.',
  B9: 'Owned production reliability for **Kubernetes (EKS, OpenShift)** clusters serving 20+ microservices — sustained **99.9% uptime** SLA across multi-AZ deployments with continuous SLO monitoring.',
  B10: 'Drove incident response and **root-cause analysis** for Linux-based production incidents; authored blameless post-mortems and runbooks that reduced repeat-incident frequency and accelerated on-call response readiness.',
  I1: 'Built and maintained **AWS infrastructure monitoring** on Linux-based environments, configured CloudWatch dashboards, and triaged production incidents across Kubernetes workloads; authored operational runbooks for recurring issue patterns and root-cause analyses.',
  I2: 'Wrote **Python and Bash** automation scripts to streamline deployment workflows and reduce manual operational steps — demonstrated ownership and impact, earning **full-time promotion within 5 months**.',
};

// Standard skill rows (always 8 rows)
const SKILLS = {
  devops: [
    ['Scripting & OS', 'Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration'],
    ['CI/CD & GitOps', 'Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD'],
    ['Containers & Service Mesh', 'Docker, Kubernetes (EKS, OpenShift), Helm, Istio, Karpenter, KEDA, Ingress-NGINX'],
    ['Infrastructure as Code', 'Terraform, AWS CloudFormation, AWS SAM, Ansible'],
    ['Cloud Platforms', 'AWS — EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch; Azure (Fundamentals)'],
    ['Observability & Monitoring', 'Prometheus, Grafana, Loki, ELK Stack, Datadog, CloudWatch'],
    ['Security & Secrets', 'HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL'],
    ['Version Control', 'Git, GitHub, Bitbucket, Branching Strategies'],
  ],
  sre: [
    ['Scripting & OS', 'Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration'],
    ['Containers & Orchestration', 'Kubernetes (EKS, OpenShift), Docker, Helm, Istio, Karpenter, KEDA, Ingress-NGINX'],
    ['Observability & Monitoring', 'Prometheus, Grafana, Loki, Grafana Alloy, ELK Stack, Datadog, CloudWatch'],
    ['CI/CD & GitOps', 'Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD'],
    ['Infrastructure as Code', 'Terraform, AWS CloudFormation, AWS SAM, Ansible'],
    ['Cloud Platforms', 'AWS — EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch; Azure (Fundamentals)'],
    ['Security & Secrets', 'HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL'],
    ['Version Control', 'Git, GitHub, Bitbucket, Branching Strategies'],
  ],
  cloud: [
    ['Cloud Platforms', 'AWS — EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch, CloudFormation, SAM, App Runner, EFS'],
    ['Infrastructure as Code', 'Terraform (34 modules, S3 remote state, DynamoDB locking), CloudFormation, AWS SAM, Ansible'],
    ['Containers & Orchestration', 'Docker, Kubernetes (EKS, OpenShift), Helm, Istio, Karpenter, KEDA, Ingress-NGINX'],
    ['CI/CD & GitOps', 'Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD'],
    ['Scripting & OS', 'Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration'],
    ['Observability & Monitoring', 'Prometheus, Grafana, Loki, ELK Stack, Datadog, CloudWatch'],
    ['Security & Secrets', 'HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL'],
    ['Version Control', 'Git, GitHub, Bitbucket, Branching Strategies'],
  ],
  azure: [
    ['CI/CD & GitOps', 'GitHub Actions, GitLab CI/CD, Jenkins, AWS CodePipeline, AWS CodeBuild, ArgoCD'],
    ['Cloud Platforms', 'AWS (primary) — EKS, EC2, Lambda, S3, RDS, VPC; Azure — DevOps, Pipelines, AKS patterns, Fundamentals'],
    ['Infrastructure as Code', 'Terraform (AWS & Azure), AWS CloudFormation, AWS SAM, Ansible'],
    ['Containers & Orchestration', 'Docker, Kubernetes (EKS/OpenShift → AKS), Helm, Istio, Karpenter, KEDA'],
    ['Scripting & OS', 'Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration'],
    ['Observability & Monitoring', 'Prometheus, Grafana, Loki, ELK Stack, Datadog, CloudWatch'],
    ['Security & Secrets', 'HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL'],
    ['Version Control', 'Git, GitHub, Bitbucket, Branching Strategies'],
  ],
  platform: [
    ['Infrastructure as Code', 'Terraform (34 reusable modules, S3 remote state, DynamoDB locking), CloudFormation, SAM, Ansible'],
    ['Containers & Orchestration', 'Docker, Kubernetes (EKS, OpenShift), Helm, ArgoCD GitOps, Karpenter, KEDA, Ingress-NGINX'],
    ['CI/CD & Developer Enablement', 'Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, SonarQube'],
    ['Cloud Platforms', 'AWS — EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch; Azure (Fundamentals)'],
    ['Scripting & OS', 'Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration'],
    ['Observability & Monitoring', 'Prometheus, Grafana, Loki, ELK Stack, Datadog, CloudWatch'],
    ['Security & Secrets', 'HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL'],
    ['Version Control', 'Git, GitHub, Bitbucket, Branching Strategies'],
  ],
};

// Standard projects (pick 2 or 3 based on role focus)
const PROJECTS = {
  crm_cicd: {
    title: 'Cloud-Native SaaS CRM Platform — Multi-Tenant AWS / EKS Build & Deploy Infrastructure',
    tech: 'Terraform · AWS EKS · Docker · Jenkins · GitLab CI/CD · GitHub Actions · AWS CodePipeline · ArgoCD · Ingress-NGINX · Prometheus · Grafana',
    bullets: [
      'Designed multi-environment build/deploy architecture with per-environment **VPC isolation and S3/DynamoDB remote state** — enabling reproducible Dev/Production infrastructure on Linux-based EKS nodes with **Ingress-NGINX Controller**; executed zero-downtime **EKS cluster upgrade (v1.33 → v1.34)** managing node group rollouts, add-on compatibility, and API deprecation remediation.',
      'Reduced compute costs by **30% ($500+/month)** via Karpenter Spot/On-Demand diversification and KEDA off-hours scale-down; migrated deprecated loki-stack to Loki + Grafana Alloy, improving log pipeline reliability.',
      'Built multi-region **disaster recovery strategy** using Velero (EBS snapshot Data Mover), S3/ECR cross-region replication, and AWS Backup with cross-region vaults — achieving **RPO < 1 hour** for production workloads.',
    ],
  },
  serverless: {
    title: 'Serverless Backend — Multi-Tenant Salon Management SaaS',
    tech: 'AWS Lambda · SAM · CloudFormation · API Gateway · RDS PostgreSQL · Amazon EFS · Secrets Manager · Python',
    bullets: [
      'Architected a serverless build/deploy system using **6 nested SAM/CloudFormation templates** with SAM build pipelines — enabling independent deployment of **30+ Python Lambda functions** with reproducible packaging and per-function least-privilege IAM.',
      'Solved Lambda layer size constraints by engineering a shared **EFS-mounted Python dependency layer** across 30+ functions — eliminating packaging bottlenecks and cutting build times by **60%+**.',
    ],
  },
  healthcare: {
    title: 'Healthcare Management System — Cloud Infrastructure & CI/CD',
    tech: 'AWS S3 · CloudFront · App Runner · ECR · Docker · GitHub Actions · Secrets Manager · IAM',
    bullets: [
      'Engineered split-hosting (S3/CloudFront frontend, Dockerised App Runner backend) with a **dual-registry GHCR/ECR strategy** — enabling zero-downtime redeployments and **~30% reduced image pull latency** while serving 500+ concurrent users.',
      'Automated full release workflow via **GitHub Actions** — Docker build, ECR/GHCR dual-push, S3 sync, CloudFront invalidation, and App Runner deploy; applied least-privilege IAM scoping that removed 5+ overly permissive roles.',
    ],
  },
};

// ─── JOB DEFINITIONS (20 resumes) ────────────────────────────────────────────
const JOBS = [
  {
    slug: '01-mastercard-platform-engineer',
    title: 'Platform Engineer I — DevOps | Mastercard',
    accent: '#1B3A6B', // navy — enterprise
    summary: 'Platform Engineer with **1+ year** of production DevOps experience building secure, scalable Linux-based infrastructure. Promoted from Intern to full-time within 5 months. Hands-on with **Terraform IaC** (34 reusable modules, **80% faster provisioning**, **95% drift reduction**), **Kubernetes (EKS, OpenShift)** at **99.9% uptime**, and **40+ CI/CD pipelines** cutting release cycles by **82% (45 → 8 min)** across 20+ Dockerised microservices.',
    skills: SKILLS.platform,
    expBullets: [B.B2, B.B1, B.B3, B.B5, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '02-cashfree-devops-engineer',
    title: 'DevOps Engineer | Cashfree Payments',
    accent: '#0F766E', // teal — fintech startup
    summary: 'DevOps Engineer with **1+ year** of production fintech-grade experience — CI/CD automation, Kubernetes cluster operations, and security-hardened cloud infrastructure. Built and owns **40+ pipelines** (Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline) cutting release cycles **82% (45 → 8 min)**. Operates **EKS** clusters at **99.9% uptime** with ArgoCD GitOps, and eliminated **~70% of operational toil** via Python/Bash automation in mission-critical payment infrastructure.',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B3, B.B4, B.B6, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '03-deutsche-telekom-devops-engineer',
    title: 'DevOps Engineer | Deutsche Telekom Digital Labs',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production experience in CI/CD automation, containerised infrastructure, and cloud operations. Promoted from Intern to full-time within 5 months. Designed **40+ automated pipelines** (Jenkins, GitLab CI/CD, GitHub Actions) and operated multi-tenant **Kubernetes (EKS, OpenShift)** clusters with ArgoCD GitOps — delivering **99.9% uptime** and **82% faster release cycles**. Experienced with **Terraform IaC**, Linux system administration, Python/Bash scripting, and full observability stack (Prometheus, Grafana, ELK, Datadog).',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B2, B.B3, B.B5, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '04-delta-air-lines-devops-engineer',
    title: 'DevOps Engineer | Delta Air Lines',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production cloud infrastructure and CI/CD experience — building reliable, automated systems aligned with aviation-grade uptime requirements. Promoted to full-time within 5 months. Maintained **99.9% uptime** across multi-AZ EKS clusters, built **40+ CI/CD pipelines** (Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline) cutting release cycles **82%**, and architected multi-region disaster recovery achieving **RPO < 1 hour**. Deep expertise in **Terraform IaC**, Python/Bash automation, and production incident RCA.',
    skills: SKILLS.devops,
    expBullets: [B.B3, B.B1, B.B2, B.B4, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '05-siemens-devops-azure',
    title: 'DevOps Engineer (Azure) | Siemens',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of CI/CD pipeline automation and cloud infrastructure experience, with Azure fundamentals and strong AWS production track record. Proficient in **GitHub Actions, GitLab CI/CD, Jenkins**, and cloud-agnostic **Terraform IaC** (34 reusable modules — directly applicable to Azure environments). Delivered **82% faster release cycles**, **99.9% uptime**, and **80% reduced provisioning time** — all transferable to Azure DevOps and AKS orchestration contexts.',
    skills: SKILLS.azure,
    expBullets: [B.B1, B.B2, B.B3, B.B5, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '06-rakuten-cloud-devops',
    title: 'Cloud DevOps Engineer | Rakuten',
    accent: '#1B3A6B',
    summary: 'Cloud DevOps Engineer with **1+ year** of production AWS and Kubernetes experience delivering secure, highly available, and cost-efficient cloud infrastructure. Provisioned multi-tenant AWS infrastructure using **Terraform IaC** (34 reusable modules) cutting provisioning time by **80%**. Operated EKS clusters at **99.9% uptime**, reduced compute costs by **30% ($500+/month)** via Karpenter and KEDA optimisation, and built multi-region disaster recovery achieving **RPO < 1 hour**.',
    skills: SKILLS.cloud,
    expBullets: [B.B2, B.B3, B.B8, B.B7, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '07-infosys-devops-ai',
    title: 'DevOps Engineer — AI | Infosys',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production CI/CD automation and Kubernetes orchestration experience — with direct applicability to AI/ML workload deployments. Promoted to full-time within 5 months. Built **40+ pipelines** cutting release cycles **82%**, operated EKS at **99.9% uptime**, and automated **70% of operational toil** with Python/Bash — core capabilities for AI model serving infrastructure and MLOps-adjacent workflows. Strong foundation in containerised deployments, **Terraform IaC**, AWS Lambda/serverless, and observability tooling.',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B5, B.B3, B.B2, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '08-piramal-finance-devops',
    title: 'DevOps Engineer | Piramal Finance',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production fintech-grade infrastructure experience — CI/CD pipelines, Kubernetes cluster operations, Terraform IaC, and security hardening. Promoted to full-time within 5 months. Owns **40+ automated pipelines** across Jenkins, GitLab CI/CD, GitHub Actions, and AWS CodePipeline; reduced release cycles by **82%**. Managed multi-tenant EKS clusters at **99.9% uptime**, governed secrets with HashiCorp Vault and AWS Secrets Manager, and achieved **95% configuration drift reduction** across Dev/Staging/Production.',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B3, B.B2, B.B6, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '09-truefoundry-devops',
    title: 'DevOps Engineer | TrueFoundry',
    accent: '#0F766E', // teal — ML platform startup
    summary: 'DevOps Engineer with **1+ year** of production Kubernetes and cloud infrastructure experience — excited to apply DevOps expertise to an enterprise AI infrastructure platform. Promoted to full-time within 5 months. Operated multi-tenant **Kubernetes (EKS, OpenShift)** clusters with ArgoCD GitOps, Karpenter autoscaling, and KEDA at **99.9% uptime**. Built **40+ CI/CD pipelines** cutting cycles by **82%**, deployed **30+ Lambda functions** on AWS serverless, and automated **70% of operational toil** via Python/Bash — directly applicable to platform engineering for AI workload serving.',
    skills: SKILLS.platform,
    expBullets: [B.B3, B.B1, B.B5, B.B2, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '10-observe-ai-platform-engineer',
    title: 'Platform Engineer I | Observe.AI',
    accent: '#0F766E',
    summary: 'Platform Engineer with **1+ year** of production infrastructure experience building developer-enabling, self-service cloud platforms. Promoted to full-time within 5 months. Designed **Terraform IaC** (34 reusable modules, **80% faster provisioning**), implemented ArgoCD GitOps workflows, and operated **Kubernetes (EKS/OpenShift)** clusters with Helm, Karpenter, and KEDA at **99.9% uptime**. Eliminated **~70% of operational toil** via Python/Bash automation and delivered multi-region disaster recovery with **RPO < 1 hour** — core platform engineering outcomes at scale.',
    skills: SKILLS.platform,
    expBullets: [B.B2, B.B3, B.B5, B.B1, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '11-cisco-sre',
    title: 'Site Reliability Engineer | Cisco',
    accent: '#1B3A6B',
    summary: 'Site Reliability Engineer with **1+ year** of production experience sustaining **99.9% uptime** across multi-AZ Kubernetes clusters, leading Linux incident RCA, and building observability pipelines. Promoted to full-time within 5 months. Owns reliability for 20+ microservices: monitors with **Prometheus, Grafana, Loki, ELK, and Datadog** — responds to incidents with structured root-cause analysis — and eliminates toil through **Python and Bash automation** (~70% reduction). Designed Velero-based multi-region disaster recovery achieving **RPO < 1 hour**.',
    skills: SKILLS.sre,
    expBullets: [B.B9, B.B10, B.B4, B.B5, B.B2],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '12-visa-sre',
    title: 'Site Reliability Engineer | Visa',
    accent: '#1B3A6B',
    summary: 'Site Reliability Engineer with **1+ year** of production experience managing high-availability Kubernetes clusters, building observability pipelines, and automating operational toil. Promoted to full-time within 5 months. Sustained **99.9% uptime** across 20+ microservices on multi-AZ EKS clusters; led production incident RCA using Prometheus, Grafana, ELK, and Datadog. Engineered multi-region disaster recovery achieving **RPO < 1 hour**. Eliminated **~70% of recurring toil** through Python and Bash automation — aligned with Visa\'s mission-critical payment infrastructure reliability standards.',
    skills: SKILLS.sre,
    expBullets: [B.B9, B.B4, B.B10, B.B5, B.B2],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '13-bluestone-devops',
    title: 'DevOps Engineer | BlueStone',
    accent: '#0F766E',
    summary: 'DevOps Engineer with **1+ year** of production AWS and Kubernetes experience automating CI/CD pipelines and operating cloud infrastructure at scale. Promoted to full-time within 5 months. Built **40+ CI/CD pipelines** (Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline) cutting release cycles by **82% (45 → 8 min)**. Operated multi-AZ EKS clusters at **99.9% uptime**, provisioned **Terraform IaC** (34 modules) with **80% faster provisioning**, and reduced compute costs by **30%** via Karpenter and KEDA — directly applicable to high-traffic e-commerce infrastructure.',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B3, B.B2, B.B8, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '14-nielseniq-devops-azure-github',
    title: 'DevOps Deployment Engineer | NielsenIQ',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production CI/CD and cloud infrastructure experience, specialising in **GitHub Actions** automation and cloud-agnostic **Terraform IaC**. Built and owns **40+ deployment pipelines** (GitHub Actions, GitLab CI/CD, Jenkins, AWS CodePipeline) cutting release cycles by **82%**. Experienced with Azure fundamentals and Terraform (34 modules) directly adaptable to Azure DevOps and AKS environments, alongside production AWS EKS operations at **99.9% uptime**. Strong Linux, Python/Bash, and observability foundation.',
    skills: SKILLS.azure,
    expBullets: [B.B1, B.B2, B.B3, B.B5, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '15-wissen-azure-devops',
    title: 'Azure DevOps Engineer | Wissen Technology',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production CI/CD automation and cloud infrastructure experience — with Azure fundamentals and strong AWS production track record fully transferable to Azure DevOps environments. Promoted to full-time within 5 months. Proficient in **GitHub Actions, GitLab CI/CD, Jenkins**, cloud-agnostic **Terraform IaC** (34 modules), and **Kubernetes** (EKS/OpenShift) — all directly applicable to Azure Pipelines, AKS, and Terraform on Azure. Delivered **82% faster release cycles** and **99.9% uptime** in production.',
    skills: SKILLS.azure,
    expBullets: [B.B1, B.B2, B.B3, B.B5, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '16-astra-security-devops',
    title: 'DevOps Engineer — Cloud & Infra Automation | Astra Security',
    accent: '#0F766E',
    summary: 'DevOps Engineer with **1+ year** of production cloud infrastructure and **security automation** experience. Promoted to full-time within 5 months. Implemented security-hardened CI/CD pipelines with SonarQube quality gates, managed **HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, and Trivy Operator** for container scanning across production. Built **Terraform IaC** (34 modules) with **95% configuration drift reduction** and IAM least-privilege scoping across Dev/Staging/Production — directly aligned with cloud security and infrastructure automation mission.',
    skills: SKILLS.devops,
    expBullets: [B.B6, B.B2, B.B1, B.B5, B.B3],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '17-moonfrog-devops-ii',
    title: 'DevOps Engineer II | Moonfrog Labs',
    accent: '#0F766E',
    summary: 'DevOps Engineer with **1+ year** of production-grade experience in CI/CD automation, Kubernetes operations, and AWS cloud infrastructure — bringing this expertise to high-scale gaming infrastructure. Promoted to full-time within 5 months. Operated multi-tenant **EKS clusters at 99.9% uptime** with ArgoCD GitOps and Karpenter autoscaling; built **40+ CI/CD pipelines** cutting release cycles **82%**; and reduced compute costs by **30% ($500+/month)** via intelligent node scaling — critical for gaming workloads with variable traffic patterns.',
    skills: SKILLS.devops,
    expBullets: [B.B3, B.B8, B.B1, B.B2, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.healthcare, PROJECTS.serverless],
  },
  {
    slug: '18-credflow-ai-devops',
    title: 'DevOps Engineer | CredFlow AI',
    accent: '#0F766E',
    summary: 'DevOps Engineer with **1+ year** of production experience in CI/CD automation, cloud infrastructure, and Kubernetes orchestration — ready to drive rapid infrastructure growth at a fintech AI startup. Promoted to full-time within 5 months. Built **40+ pipelines** cutting release cycles **82%**, operated EKS at **99.9% uptime**, and automated **70% of operational toil** via Python/Bash. Owns end-to-end infrastructure autonomously: AWS Lambda, EKS, RDS, and VPC in production — ideal for startup pace and full-stack DevOps ownership.',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B5, B.B3, B.B2, B.B4],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '19-transunion-devops',
    title: 'DevOps Engineer | TransUnion',
    accent: '#1B3A6B',
    summary: 'DevOps Engineer with **1+ year** of production experience delivering secure, reliable CI/CD infrastructure and cloud operations in data-sensitive environments. Promoted to full-time within 5 months. Built **40+ pipelines** with SonarQube quality gates cutting release cycles by **82%**. Operated multi-AZ EKS clusters at **99.9% uptime**, managed security hardening (HashiCorp Vault, Sealed Secrets, Trivy, IAM least-privilege), and provisioned **Terraform IaC** achieving **95% drift reduction** — aligned with TransUnion\'s data security and reliability requirements.',
    skills: SKILLS.devops,
    expBullets: [B.B1, B.B6, B.B2, B.B3, B.B5],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
  {
    slug: '20-nexthink-platform-sre',
    title: 'Platform Software Engineer — SRE | Nexthink',
    accent: '#1B3A6B',
    summary: 'Platform SRE with **1+ year** of production experience at the intersection of platform engineering and site reliability — building developer-enabling infrastructure and sustaining **99.9% uptime**. Promoted to full-time within 5 months. Designed **Terraform IaC** (34 modules) for self-service provisioning (**80% faster**, **95% drift reduction**), operated Kubernetes (EKS, OpenShift) with ArgoCD GitOps, built unified observability (Prometheus, Grafana, ELK, Datadog), and eliminated **~70% of recurring toil** through Python/Bash automation — core platform SRE outcomes.',
    skills: SKILLS.sre,
    expBullets: [B.B9, B.B2, B.B4, B.B5, B.B10],
    internBullets: [B.I1, B.I2],
    projects: [PROJECTS.crm_cicd, PROJECTS.serverless, PROJECTS.healthcare],
  },
];

// ─── GENERATE ALL ─────────────────────────────────────────────────────────────
let count = 0;
for (const job of JOBS) {
  const html = buildHTML(job);
  const outPath = resolve(__dirname, 'output', `${job.slug}.html`);
  writeFileSync(outPath, html, 'utf8');
  console.log(`✅ ${job.slug}.html`);
  count++;
}
console.log(`\n🎉 Generated ${count} single-page resumes in output/`);
console.log(`\nNext: generate PDFs with:`);
JOBS.forEach(j => console.log(`  node generate-pdf.mjs output/${j.slug}.html output/${j.slug}.pdf`));
