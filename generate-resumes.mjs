#!/usr/bin/env node
/**
 * generate-resumes.mjs
 * Generates individual tailored HTML resumes for each job.
 * Section order matches cv.md: Summary → Skills → Experience → Projects → Education
 * Run: node generate-resumes.mjs
 * Then: node generate-pdf.mjs output/job-<slug>.html output/job-<slug>.pdf
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(__dirname, 'output'), { recursive: true });

// ─── CANDIDATE (from config/profile.yml) ────────────────────────────────────
const CANDIDATE = {
  name: 'UDAY VARMORA',
  phone: '+91 96623 85170',
  email: 'varmorauday1045@gmail.com',
  linkedin_url: 'https://linkedin.com/in/udayvarmora',
  linkedin_display: 'linkedin.com/in/udayvarmora',
  github_url: 'https://github.com/udayvarmora07',
  github_display: 'github.com/udayvarmora07',
  location: 'Ahmedabad, India',
};

// ─── SHARED EXPERIENCE BULLETS ───────────────────────────────────────────────
// Each bullet is tagged with themes so we can pick & reorder per JD
const EXP_BULLETS = {
  cicd: `<li>Designed and maintained <strong>40+ CI/CD pipelines</strong> (Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild) automating build-test-deploy workflows across <strong>20+ Dockerised microservices</strong> — cutting release cycles by <strong>82% (45 min → under 8 min)</strong> with zero manual intervention.</li>`,
  iac: `<li>Provisioned multi-environment AWS infrastructure on <strong>Linux (Ubuntu, Amazon Linux, RHEL)</strong> using <strong>Terraform IaC</strong> (34 reusable modules, S3 remote state, DynamoDB locking) — reducing provisioning time by <strong>80%</strong> and configuration drift by <strong>95%</strong> across Dev, Staging, and Production.</li>`,
  k8s: `<li>Operated <strong>Kubernetes (EKS, OpenShift)</strong> clusters with ArgoCD GitOps, Helm, Istio service mesh, and Ingress-NGINX Controller — managing zero-downtime rollouts, Karpenter autoscaling, and KEDA event-driven scaling; sustained <strong>99.9% uptime</strong> across multi-AZ clusters.</li>`,
  observability: `<li>Drove <strong>root-cause analysis</strong> for Linux-based production incidents (CPU, memory, network, container runtime); built observability stack with <strong>Prometheus, Grafana, Loki, ELK Stack, and Datadog</strong>; authored runbooks and post-incident reviews.</li>`,
  automation: `<li>Developed <strong>Python and Bash</strong> automation eliminating <strong>~70% of recurring operational toil</strong> — covering cluster operations, log triage, secret rotation, and pipeline scripting; integrated SonarQube quality gates into CI/CD workflows.</li>`,
  security: `<li>Managed cloud security posture: <strong>HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy</strong> container scanning, IAM least-privilege scoping, KMS encryption, and TLS/SSL across all environments.</li>`,
  dr: `<li>Architected <strong>multi-region disaster recovery</strong> using Velero (EBS snapshot Data Mover), S3/ECR cross-region replication, and AWS Backup — achieving <strong>RPO &lt; 1 hour</strong> for production workloads.</li>`,
  cost: `<li>Reduced compute costs by <strong>30% ($500+/month)</strong> via Karpenter Spot/On-Demand node diversification and KEDA event-driven off-hours scale-down on multi-tenant EKS clusters.</li>`,
  azure: `<li>Worked with <strong>Azure</strong> fundamentals and multi-cloud architecture patterns; experienced with cloud-agnostic IaC tooling (Terraform) adaptable across AWS and Azure environments.</li>`,
};

const INTERN_BULLETS = {
  monitoring: `<li>Built and maintained <strong>AWS infrastructure monitoring</strong> on Linux environments — configured CloudWatch dashboards, triaged production incidents across Kubernetes workloads, and authored operational runbooks.</li>`,
  promotion: `<li>Wrote <strong>Python and Bash</strong> automation scripts to streamline deployment workflows and reduce manual operational steps — demonstrated ownership and impact, earning <strong>full-time promotion within 5 months</strong>.</li>`,
};

// ─── SHARED PROJECTS ─────────────────────────────────────────────────────────
const PROJECTS = {
  crm: (focus = 'cicd') => {
    const focusBadge = { cicd: 'CI/CD & EKS', sre: 'Reliability & DR', cloud: 'AWS Architecture', platform: 'GitOps & IaC', azure: 'Multi-Cloud IaC' }[focus] || 'Production';
    return `
    <div class="project">
      <span class="project-title">Cloud-Native SaaS CRM — Multi-Tenant AWS EKS Build &amp; Deploy</span>
      <span class="project-badge">${focusBadge}</span>
      <div class="project-tech">Terraform · AWS EKS · Docker · Jenkins · GitLab CI/CD · GitHub Actions · AWS CodePipeline · ArgoCD · Ingress-NGINX · Prometheus · Grafana · Velero · Karpenter · KEDA</div>
      <div class="project-desc">
        Built multi-environment CI/CD architecture with per-environment VPC isolation and S3/DynamoDB remote state — enabling reproducible Dev/Production infrastructure with zero-downtime EKS upgrades (v1.33 → v1.34). Reduced compute costs by <strong>30% ($500+/month)</strong> via Karpenter Spot/On-Demand node diversification and KEDA off-hours scale-down. Implemented multi-region DR (Velero, S3/ECR cross-region replication, AWS Backup) achieving <strong>RPO &lt; 1 hour</strong>.
      </div>
    </div>`;
  },
  serverless: () => `
    <div class="project">
      <span class="project-title">Serverless Backend — Multi-Tenant Salon Management SaaS</span>
      <span class="project-badge">Production</span>
      <div class="project-tech">AWS Lambda · SAM · CloudFormation · API Gateway · RDS PostgreSQL · Amazon EFS · Secrets Manager · Python</div>
      <div class="project-desc">
        Architected serverless build/deploy system using <strong>6 nested SAM/CloudFormation templates</strong> with independent deployment of <strong>30+ Python Lambda functions</strong> with reproducible packaging and per-function least-privilege IAM. Engineered shared <strong>EFS-mounted Python dependency layer</strong> eliminating packaging bottlenecks and cutting build times by <strong>60%+</strong>.
      </div>
    </div>`,
  healthcare: () => `
    <div class="project">
      <span class="project-title">Healthcare Management System — Cloud Infrastructure &amp; CI/CD</span>
      <span class="project-badge">Production</span>
      <div class="project-tech">AWS S3 · CloudFront · App Runner · ECR · GHCR · Docker · GitHub Actions · Secrets Manager · IAM</div>
      <div class="project-desc">
        Engineered split-hosting (S3/CloudFront frontend, Dockerised App Runner backend) with <strong>dual-registry GHCR/ECR strategy</strong> enabling zero-downtime redeployments and <strong>~30% reduced image pull latency</strong> serving 500+ concurrent users. Automated full release workflow via GitHub Actions; applied least-privilege IAM scoping removing 5+ overly permissive roles.
      </div>
    </div>`,
};

// ─── SHARED SKILLS SECTION ────────────────────────────────────────────────────
function buildSkills(config = {}) {
  const rows = [
    config.cicd_first
      ? `<span class="skill-item"><span class="skill-category">CI/CD &amp; GitOps:</span> Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD</span>`
      : `<span class="skill-item"><span class="skill-category">Scripting &amp; OS:</span> Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration</span>`,
    config.azure_first
      ? `<span class="skill-item"><span class="skill-category">Cloud:</span> AWS (EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch, CodePipeline, App Runner), Azure (DevOps, Pipelines, Fundamentals)</span>`
      : `<span class="skill-item"><span class="skill-category">Cloud:</span> AWS (EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch, CodePipeline, App Runner), Azure (Fundamentals)</span>`,
    `<span class="skill-item"><span class="skill-category">Containers &amp; Orchestration:</span> Kubernetes (EKS, OpenShift), Docker, Helm, Istio, Karpenter, KEDA, Ingress-NGINX</span>`,
    `<span class="skill-item"><span class="skill-category">IaC:</span> Terraform (34 reusable modules), AWS CloudFormation, AWS SAM, Ansible</span>`,
    config.cicd_first
      ? `<span class="skill-item"><span class="skill-category">Scripting &amp; OS:</span> Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL)</span>`
      : `<span class="skill-item"><span class="skill-category">CI/CD &amp; GitOps:</span> Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD</span>`,
    `<span class="skill-item"><span class="skill-category">Observability:</span> Prometheus, Grafana, Loki, ELK Stack, Datadog, CloudWatch</span>`,
    `<span class="skill-item"><span class="skill-category">Security &amp; Secrets:</span> HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy, IAM, KMS, TLS/SSL</span>`,
    `<span class="skill-item"><span class="skill-category">Version Control:</span> Git, GitHub, Bitbucket, GitOps workflows</span>`,
  ];
  return `<div class="skills-grid">${rows.join('\n      ')}</div>`;
}

// ─── HTML TEMPLATE ────────────────────────────────────────────────────────────
function buildHTML({ title, summary, competencies, expBullets, internBullets, projects, skills }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${CANDIDATE.name} — ${title}</title>
<style>
  @font-face { font-family: 'Space Grotesk'; src: url('./fonts/space-grotesk-latin.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Space Grotesk'; src: url('./fonts/space-grotesk-latin-ext.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
  @font-face { font-family: 'DM Sans'; src: url('./fonts/dm-sans-latin.woff2') format('woff2'); font-weight: 100 1000; font-style: normal; font-display: swap; }
  @font-face { font-family: 'DM Sans'; src: url('./fonts/dm-sans-latin-ext.woff2') format('woff2'); font-weight: 100 1000; font-style: normal; font-display: swap; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'DM Sans', sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a2e; background: #ffffff; }
  .page { width: 100%; max-width: 210mm; margin: 0 auto; }
  .header { margin-bottom: 20px; }
  .header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.02em; margin-bottom: 6px; line-height: 1.1; }
  .header-gradient { height: 2px; background: linear-gradient(to right, hsl(187, 74%, 32%), hsl(270, 70%, 45%)); border-radius: 1px; margin-bottom: 10px; }
  .contact-row { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 10.5px; color: #555; }
  .contact-row a { color: #555; text-decoration: none; }
  .contact-row .separator { color: #ccc; }
  .section { margin-bottom: 18px; }
  .section-title { font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: hsl(187, 74%, 32%); border-bottom: 1.5px solid #e2e2e2; padding-bottom: 4px; margin-bottom: 10px; }
  .summary-text { font-size: 11px; line-height: 1.7; color: #2f2f2f; }
  a { white-space: nowrap; }
  .competencies-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .competency-tag { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 500; color: hsl(187, 74%, 28%); background: hsl(187, 40%, 95%); padding: 4px 10px; border-radius: 3px; border: 1px solid hsl(187, 40%, 88%); }
  .skills-grid { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .skill-item { font-size: 10.5px; color: #444; }
  .skill-category { font-weight: 600; color: #333; font-size: 10.5px; }
  .job { margin-bottom: 14px; }
  .job-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 4px; }
  .job-company { font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; font-weight: 600; color: hsl(270, 70%, 45%); }
  .job-period { font-size: 10.5px; color: #777; white-space: nowrap; }
  .job-role { font-size: 11px; font-weight: 600; color: #333; margin-bottom: 6px; }
  .job-location { font-size: 10px; color: #888; }
  .job ul { padding-left: 18px; margin-top: 6px; }
  .job li { font-size: 10.5px; line-height: 1.6; color: #333; margin-bottom: 4px; }
  .job li strong { font-weight: 600; }
  .project { margin-bottom: 12px; }
  .project-title { font-family: 'Space Grotesk', sans-serif; font-size: 11.5px; font-weight: 600; color: hsl(270, 70%, 45%); }
  .project-badge { font-size: 9px; font-weight: 500; color: hsl(187, 74%, 32%); background: hsl(187, 40%, 95%); padding: 1px 6px; border-radius: 2px; margin-left: 6px; }
  .project-desc { font-size: 10.5px; color: #444; margin-top: 3px; line-height: 1.55; }
  .project-tech { font-size: 9.5px; color: #888; margin-top: 3px; }
  .edu-item { margin-bottom: 8px; }
  .edu-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .edu-title { font-weight: 600; font-size: 11px; color: #333; }
  .edu-org { color: hsl(270, 70%, 45%); font-weight: 500; }
  .edu-year { font-size: 10px; color: #777; white-space: nowrap; }
  .edu-desc { font-size: 10px; color: #666; margin-top: 2px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 0; } }
  .avoid-break, .job, .project, .edu-item { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header avoid-break">
    <h1>${CANDIDATE.name}</h1>
    <div class="header-gradient"></div>
    <div class="contact-row">
      <span>${CANDIDATE.phone}</span>
      <span class="separator">|</span>
      <span>${CANDIDATE.email}</span>
      <span class="separator">|</span>
      <a href="${CANDIDATE.linkedin_url}">${CANDIDATE.linkedin_display}</a>
      <span class="separator">|</span>
      <a href="${CANDIDATE.github_url}">${CANDIDATE.github_display}</a>
      <span class="separator">|</span>
      <span>${CANDIDATE.location}</span>
    </div>
  </div>

  <!-- PROFESSIONAL SUMMARY -->
  <div class="section avoid-break">
    <div class="section-title">Professional Summary</div>
    <div class="summary-text">${summary}</div>
  </div>

  <!-- TECHNICAL SKILLS (matches cv.md order: Summary → Skills → Experience) -->
  <div class="section avoid-break">
    <div class="section-title">Technical Skills</div>
    ${skills}
  </div>

  <!-- CORE COMPETENCIES -->
  <div class="section">
    <div class="section-title">Core Competencies</div>
    <div class="competencies-grid">
      ${competencies.map(c => `<span class="competency-tag">${c}</span>`).join('\n      ')}
    </div>
  </div>

  <!-- PROFESSIONAL EXPERIENCE -->
  <div class="section">
    <div class="section-title">Professional Experience</div>

    <div class="job">
      <div class="job-header">
        <span class="job-company">eSparkBiz Technologies</span>
        <span class="job-period">Jun 2025 – Apr 2026</span>
      </div>
      <div class="job-role">DevOps Engineer <span class="job-location">· Ahmedabad, India</span></div>
      <ul>
        ${expBullets.map(b => EXP_BULLETS[b] || b).join('\n        ')}
      </ul>
    </div>

    <div class="job">
      <div class="job-header">
        <span class="job-company">eSparkBiz Technologies</span>
        <span class="job-period">Jan 2025 – May 2025</span>
      </div>
      <div class="job-role">DevOps Engineer Intern <span class="job-location">· Ahmedabad, India</span></div>
      <ul>
        ${internBullets.map(b => INTERN_BULLETS[b] || b).join('\n        ')}
      </ul>
    </div>
  </div>

  <!-- KEY PROJECTS -->
  <div class="section avoid-break">
    <div class="section-title">Key Projects</div>
    ${projects}
  </div>

  <!-- EDUCATION -->
  <div class="section avoid-break">
    <div class="section-title">Education</div>
    <div class="edu-item">
      <div class="edu-header">
        <span class="edu-title">B.Tech, Information Technology — <span class="edu-org">Dharmsinh Desai University, Gujarat</span></span>
        <span class="edu-year">2021 – 2025</span>
      </div>
      <div class="edu-desc">CGPA: 7.25 / 10</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── JOB DEFINITIONS ─────────────────────────────────────────────────────────
// Each job: slug, company, role, tailored content
const JOBS = [

  // ──────────────────────────────────────────────────────────────────────────
  // 01 — Mastercard | Platform Engineer I (DevOps) — Pune (entry-level, 0.5-1.5 yrs)
  {
    slug: '01-mastercard-platform-engineer',
    title: 'Platform Engineer I — DevOps',
    summary: `Platform Engineer with <strong>1.4 years of production DevOps experience</strong> building secure, scalable infrastructure at Mastercard-grade quality. Promoted from Intern to full-time within 5 months. Hands-on expertise across <strong>Linux system administration, Terraform IaC</strong> (34 reusable modules), <strong>Kubernetes (EKS, OpenShift)</strong>, and CI/CD automation — delivering 99.9% uptime and 82% faster release cycles for multi-tenant SaaS platforms.`,
    competencies: ['Linux System Administration', 'Terraform IaC', 'Kubernetes (EKS)', 'CI/CD Pipelines', 'Python · Bash Scripting', 'AWS Infrastructure', 'Prometheus · Grafana', 'GitOps (ArgoCD)', 'Docker · Helm', 'IAM · Security'],
    expBullets: ['iac', 'cicd', 'k8s', 'automation', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 02 — Cashfree | DevOps Engineer — Bangalore (fintech, AWS/K8s focus)
  {
    slug: '02-cashfree-devops-engineer',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production fintech-grade experience</strong> managing high-availability AWS EKS infrastructure, CI/CD automation, and security-hardened deployments. Promoted to full-time within 5 months of internship. Built and owns <strong>40+ CI/CD pipelines</strong> across Jenkins, GitLab CI/CD, GitHub Actions, and AWS CodePipeline — reducing release cycles by <strong>82%</strong>. Strong practitioner of Terraform IaC, Kubernetes orchestration, Prometheus/Grafana observability, and HashiCorp Vault secrets management in production-critical environments.`,
    competencies: ['CI/CD Pipeline Design (Jenkins · GitLab · GitHub Actions)', 'Kubernetes EKS · Helm · ArgoCD GitOps', 'Terraform IaC — 34 Reusable Modules', 'AWS Infrastructure (EKS, Lambda, RDS, VPC)', 'Python · Bash Automation (70% toil reduction)', 'HashiCorp Vault · Secrets Manager · IAM', 'Prometheus · Grafana · ELK · Datadog', 'Linux System Administration · Incident RCA', 'Docker · Istio · Ingress-NGINX', '99.9% Uptime SLA'],
    expBullets: ['cicd', 'k8s', 'observability', 'security', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 03 — Deutsche Telekom Digital Labs | DevOps Engineer — Gurgaon
  {
    slug: '03-deutsche-telekom-devops-engineer',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production experience</strong> across CI/CD automation, containerized infrastructure, and cloud operations. Promoted from Intern to full-time within 5 months. Designed <strong>40+ automated pipelines</strong> (Jenkins, GitLab CI/CD, GitHub Actions) and operated multi-tenant <strong>Kubernetes (EKS, OpenShift)</strong> clusters with ArgoCD GitOps — delivering 99.9% uptime and 82% faster release cycles. Experienced with Terraform IaC, Linux system administration, Python/Bash scripting, and observability tooling (Prometheus, Grafana, ELK, Datadog).`,
    competencies: ['CI/CD Automation (Jenkins · GitLab CI/CD · GitHub Actions)', 'Kubernetes (EKS, OpenShift) · Helm · ArgoCD', 'Terraform IaC', 'AWS Cloud Infrastructure', 'Docker · Containerization', 'Python · Bash Scripting', 'Prometheus · Grafana · ELK · Datadog', 'Linux Administration', 'GitOps Workflows', 'Security — Vault · IAM · Sealed Secrets'],
    expBullets: ['cicd', 'k8s', 'iac', 'automation', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 04 — Delta Air Lines | DevOps Engineer — Bangalore
  {
    slug: '04-delta-air-lines-devops-engineer',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of experience</strong> building robust CI/CD infrastructure, managing Kubernetes clusters, and automating cloud operations at scale. Promoted from Intern to full-time within 5 months. Maintained <strong>99.9% uptime</strong> across multi-AZ EKS clusters serving 20+ microservices, built <strong>40+ CI/CD pipelines</strong> cutting release cycles by 82%, and authored multi-region disaster recovery achieving <strong>RPO &lt; 1 hour</strong>. Experienced with AWS, Terraform IaC, Python/Bash automation, and production incident RCA — aligned with Delta's high-reliability aviation-grade infrastructure requirements.`,
    competencies: ['Kubernetes (EKS, OpenShift) — 99.9% Uptime', 'CI/CD Pipelines (Jenkins · GitHub Actions · CodePipeline)', 'AWS Infrastructure (EKS, EC2, S3, RDS, VPC)', 'Terraform IaC', 'Multi-Region Disaster Recovery (RPO &lt; 1h)', 'Production Incident RCA · Runbooks', 'Python · Bash Automation', 'ArgoCD GitOps · Helm', 'Prometheus · Grafana · ELK', 'Linux System Administration'],
    expBullets: ['k8s', 'cicd', 'iac', 'dr', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('sre') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 05 — Siemens | DevOps Engineer (Azure) — Bangalore
  {
    slug: '05-siemens-devops-azure',
    title: 'DevOps Engineer (Azure)',
    summary: `DevOps Engineer with <strong>1.4 years of cloud infrastructure and CI/CD experience</strong>, with Azure fundamentals and strong AWS production track record. Promoted from Intern to full-time within 5 months. Proficient in cloud-agnostic IaC with <strong>Terraform</strong> (34 reusable modules adaptable to Azure/AWS), CI/CD automation via <strong>GitHub Actions, GitLab CI/CD, Jenkins</strong>, and Kubernetes orchestration (EKS/OpenShift). Delivered 82% faster release cycles, 99.9% uptime, and 80% reduced provisioning time — transferable directly to Azure DevOps and AKS environments.`,
    competencies: ['Azure DevOps · Azure Pipelines', 'Terraform IaC (AWS & Azure)', 'GitHub Actions · GitLab CI/CD · Jenkins', 'Kubernetes (EKS/OpenShift → AKS patterns)', 'Docker · Helm · ArgoCD GitOps', 'Python · Bash Scripting', 'Prometheus · Grafana · ELK', 'Linux System Administration', 'Secrets Management (Vault · Secrets Manager)', 'AWS Cloud (production) + Azure (Fundamentals)'],
    expBullets: ['cicd', 'iac', 'k8s', 'azure', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: true, azure_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 06 — Rakuten | Cloud DevOps Engineer — Bangalore
  {
    slug: '06-rakuten-cloud-devops',
    title: 'Cloud DevOps Engineer',
    summary: `Cloud DevOps Engineer with <strong>1.4 years of production AWS and Kubernetes experience</strong> delivering secure, highly available, and cost-efficient cloud infrastructure. Promoted from Intern to full-time within 5 months. Provisioned multi-tenant AWS infrastructure using <strong>Terraform IaC</strong> (34 reusable modules) cutting provisioning time by 80%. Operated EKS clusters at 99.9% uptime, reduced compute costs by <strong>30% ($500+/month)</strong> via Karpenter and KEDA optimization, and built multi-region disaster recovery achieving <strong>RPO &lt; 1 hour</strong>.`,
    competencies: ['AWS Cloud Architecture (EKS, Lambda, S3, RDS, VPC)', 'Terraform IaC — 34 Reusable Modules', 'Kubernetes (EKS, OpenShift) · 99.9% Uptime', 'CI/CD Automation (Jenkins · GitHub Actions · CodePipeline)', 'Cost Optimisation — 30% reduction ($500+/mo)', 'Multi-Region Disaster Recovery (RPO &lt; 1h)', 'Python · Bash Scripting', 'Prometheus · Grafana · Datadog', 'Docker · Helm · ArgoCD GitOps', 'IAM · Vault · KMS · TLS/SSL'],
    expBullets: ['iac', 'k8s', 'cost', 'dr', 'cicd'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cloud') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 07 — Infosys | DevOps Engineer - AI — Bangalore
  {
    slug: '07-infosys-devops-ai',
    title: 'DevOps Engineer — AI',
    summary: `DevOps Engineer with <strong>1.4 years of production experience</strong> in CI/CD automation, Kubernetes orchestration, and cloud infrastructure — now expanding into AI/ML pipeline support and MLOps patterns. Promoted from Intern to full-time within 5 months. Built and owns 40+ CI/CD pipelines cutting release cycles by 82%, operated EKS clusters at 99.9% uptime, and automated 70% of operational toil with Python and Bash. Experienced with container-native deployments, Terraform IaC, and observability — with direct applicability to AI model serving infrastructure and MLOps workflows.`,
    competencies: ['CI/CD Pipelines for AI/ML Workloads', 'Kubernetes EKS · Docker · Helm', 'Python · Bash Automation (MLOps-ready)', 'Terraform IaC · AWS Infrastructure', 'ArgoCD GitOps · GitHub Actions', 'AWS Lambda · Serverless Model Serving', 'Prometheus · Grafana · Datadog Observability', 'Linux System Administration', 'IAM · Secrets Manager · Security', 'Container Orchestration at Scale'],
    expBullets: ['cicd', 'automation', 'k8s', 'iac', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 08 — Piramal Finance | DevOps Engineer — Bangalore (fintech, AWS/K8s)
  {
    slug: '08-piramal-finance-devops',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production fintech-grade infrastructure experience</strong> — CI/CD pipelines, Kubernetes cluster operations, Terraform IaC, and security hardening. Promoted from Intern to full-time within 5 months. Owns <strong>40+ automated pipelines</strong> across Jenkins, GitLab CI/CD, GitHub Actions, and AWS CodePipeline, reducing release cycles by 82%. Managed multi-tenant EKS clusters at 99.9% uptime, integrated HashiCorp Vault and AWS Secrets Manager for secrets governance, and achieved 95% configuration drift reduction across Dev/Staging/Production.`,
    competencies: ['CI/CD Pipelines (Jenkins · GitLab CI/CD · GitHub Actions)', 'Kubernetes EKS · ArgoCD GitOps · Helm', 'Terraform IaC (95% drift reduction)', 'AWS Infrastructure — EKS, EC2, RDS, VPC', 'Security — Vault · Secrets Manager · Trivy · IAM', 'Python · Bash Automation', 'Prometheus · Grafana · ELK · Datadog', 'Linux Administration · Incident RCA', 'Docker · Istio Service Mesh', 'SonarQube Quality Gates'],
    expBullets: ['cicd', 'k8s', 'iac', 'security', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 09 — TrueFoundry | DevOps Engineer — Bangalore (ML platform startup)
  {
    slug: '09-truefoundry-devops',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of hands-on Kubernetes and cloud infrastructure experience</strong>, excited to bring production DevOps expertise to an ML platform startup. Promoted from Intern to full-time within 5 months. Operated multi-tenant <strong>Kubernetes (EKS, OpenShift)</strong> clusters with ArgoCD GitOps, Karpenter autoscaling, and KEDA — sustained 99.9% uptime. Built 40+ CI/CD pipelines cutting release cycles 82%, deployed serverless workloads on AWS Lambda/SAM, and automated 70% of operational toil with Python and Bash — directly applicable to platform engineering for ML model serving infrastructure.`,
    competencies: ['Kubernetes (EKS, OpenShift) · ArgoCD · Helm · Karpenter · KEDA', 'CI/CD Automation (Jenkins · GitHub Actions · GitLab CI/CD)', 'Python · Bash Automation', 'Terraform IaC · AWS Infrastructure', 'Serverless (Lambda · SAM · CloudFormation)', 'Prometheus · Grafana · Loki · Datadog', 'Docker · Istio Service Mesh', 'Linux System Administration', 'IAM · HashiCorp Vault · Secrets Manager', 'GitOps · DevOps for ML Workloads'],
    expBullets: ['k8s', 'cicd', 'automation', 'iac', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('platform') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 10 — Observe.AI | Platform Engineer - 1 — Bangalore (AI SaaS, entry-level)
  {
    slug: '10-observe-ai-platform-engineer',
    title: 'Platform Engineer I',
    summary: `Platform Engineer with <strong>1.4 years of production infrastructure experience</strong> building developer-enabling, self-service cloud platforms. Promoted from Intern to full-time within 5 months. Designed <strong>Terraform IaC</strong> (34 reusable modules) for self-service multi-environment provisioning, implemented ArgoCD GitOps workflows for platform teams, and operated Kubernetes (EKS/OpenShift) clusters with Helm, Karpenter, and KEDA. Delivered 80% faster infrastructure provisioning, 95% configuration drift reduction, and 70% toil reduction through Python/Bash automation — core platform engineering outcomes.`,
    competencies: ['Terraform IaC — Self-Service Infrastructure', 'Kubernetes (EKS, OpenShift) · ArgoCD GitOps', 'Helm Chart Authoring · Platform Standardization', 'CI/CD Developer Enablement (Jenkins · GitHub Actions)', 'Python · Bash Automation (70% toil reduction)', 'AWS Cloud Infrastructure', 'Prometheus · Grafana · Observability', 'Linux Administration', 'IAM · Vault · Secrets Manager', 'Developer Experience Engineering'],
    expBullets: ['iac', 'k8s', 'automation', 'cicd', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('platform') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 11 — Cisco | Site Reliability Engineer — Bangalore
  {
    slug: '11-cisco-sre',
    title: 'Site Reliability Engineer',
    summary: `Site Reliability Engineer with <strong>1.4 years of production experience</strong> sustaining <strong>99.9% uptime</strong> across multi-AZ Kubernetes clusters, leading Linux incident RCA, and building observability pipelines. Promoted from Intern to full-time within 5 months. Owns reliability for 20+ microservices: monitors with <strong>Prometheus, Grafana, Loki, ELK, and Datadog</strong> — responds to production incidents with structured root-cause analysis — and eliminates toil through Python and Bash automation (70% reduction). Designed Velero-based multi-region disaster recovery achieving <strong>RPO &lt; 1 hour</strong>.`,
    competencies: ['Kubernetes (EKS, OpenShift) — 99.9% Uptime', 'Production Incident RCA · Runbook Authoring', 'Prometheus · Grafana · Loki · ELK · Datadog', 'Linux System Administration (Ubuntu, RHEL, Amazon Linux)', 'Disaster Recovery — Velero · RPO &lt; 1h', 'Python · Bash Automation (70% toil reduction)', 'ArgoCD GitOps · Helm · Karpenter · KEDA', 'CI/CD Pipeline Reliability (Jenkins · GitHub Actions)', 'HashiCorp Vault · Secrets Manager · IAM', 'Post-Incident Review &amp; SLO Management'],
    expBullets: ['k8s', 'observability', 'automation', 'dr', 'cicd'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('sre') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 12 — Visa | Site Reliability Engineer — Bangalore
  {
    slug: '12-visa-sre',
    title: 'Site Reliability Engineer',
    summary: `Site Reliability Engineer with <strong>1.4 years of production experience</strong> managing high-availability Kubernetes clusters, building observability pipelines, and automating operational toil. Promoted from Intern to full-time within 5 months. Sustained <strong>99.9% uptime</strong> across 20+ microservices on multi-AZ EKS clusters, ran production incident RCA using Prometheus, Grafana, ELK, and Datadog, and engineered multi-region disaster recovery achieving <strong>RPO &lt; 1 hour</strong>. Eliminated ~70% of recurring toil through Python and Bash automation — aligned with Visa's mission-critical payment infrastructure reliability standards.`,
    competencies: ['Kubernetes (EKS, OpenShift) — 99.9% Uptime SLA', 'Production Incident Response &amp; Root Cause Analysis', 'Prometheus · Grafana · Loki · ELK · Datadog', 'Multi-Region DR — Velero · RPO &lt; 1 hour', 'Linux Administration (Ubuntu, RHEL, Amazon Linux)', 'Python · Bash Automation (70% toil reduction)', 'AWS Infrastructure (EKS, EC2, S3, VPC, CloudWatch)', 'Terraform IaC · ArgoCD GitOps · Helm', 'Post-Mortems · Runbooks · SLO Tracking', 'IAM · HashiCorp Vault · TLS/SSL Security'],
    expBullets: ['k8s', 'observability', 'dr', 'automation', 'iac'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('sre') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 13 — BlueStone.com | DevOps Engineer — Bangalore (e-commerce, AWS focus)
  {
    slug: '13-bluestone-devops',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production AWS and Kubernetes experience</strong> automating CI/CD pipelines and operating cloud infrastructure at scale. Promoted from Intern to full-time within 5 months. Built <strong>40+ CI/CD pipelines</strong> (Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline) cutting release cycles by 82%. Operated multi-AZ EKS clusters at 99.9% uptime, provisioned Terraform IaC (34 reusable modules) with 80% faster provisioning, and reduced compute costs by 30% — applicable directly to BlueStone's high-traffic e-commerce infrastructure.`,
    competencies: ['CI/CD Pipelines (Jenkins · GitLab CI/CD · GitHub Actions)', 'Kubernetes EKS · Docker · Helm · ArgoCD', 'AWS Infrastructure (EKS, EC2, S3, RDS, VPC, ECR)', 'Terraform IaC (80% faster provisioning)', 'Python · Bash Automation', 'Prometheus · Grafana · ELK · Datadog', 'Linux Administration · Incident RCA', 'Cost Optimisation — Karpenter · KEDA', 'IAM · Secrets Manager · Security Hardening', 'Zero-Downtime Deployments'],
    expBullets: ['cicd', 'k8s', 'iac', 'cost', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 14 — NielsenIQ | DevOps Deployment Engineer (Azure & GitHub Actions) — India
  {
    slug: '14-nielseniq-devops-azure-github',
    title: 'DevOps Deployment Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production CI/CD and cloud infrastructure experience</strong>, specializing in GitHub Actions automation and cloud-agnostic IaC with Terraform. Promoted from Intern to full-time within 5 months. Built and owns <strong>40+ deployment pipelines</strong> (GitHub Actions, GitLab CI/CD, Jenkins, AWS CodePipeline) — cutting release cycles by <strong>82%</strong>. Experienced with Azure fundamentals and cloud-agnostic Terraform (34 modules) adaptable to Azure DevOps and AKS environments, alongside production AWS EKS operations at 99.9% uptime.`,
    competencies: ['GitHub Actions — Primary CI/CD Tool', 'Azure DevOps · Azure Pipelines (Fundamentals)', 'Terraform IaC — Cloud Agnostic (AWS &amp; Azure)', 'Kubernetes (EKS/OpenShift → AKS patterns)', 'Docker · Container Deployments', 'Python · Bash Deployment Automation', 'Prometheus · Grafana · ELK Observability', 'Linux System Administration', 'IAM · Secrets Manager · Security Gates', 'Release Engineering · Artifact Management'],
    expBullets: ['cicd', 'azure', 'k8s', 'iac', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: true, azure_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 15 — Wissen Technology | Azure DevOps Engineer — Bangalore
  {
    slug: '15-wissen-azure-devops',
    title: 'Azure DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production experience</strong> in CI/CD pipeline automation, container orchestration, and cloud-agnostic infrastructure — with Azure fundamentals and strong AWS production track record transferable to Azure DevOps environments. Promoted from Intern to full-time within 5 months. Proficient in <strong>GitHub Actions, GitLab CI/CD, Jenkins</strong>, Terraform IaC (34 reusable modules), and Kubernetes (EKS/OpenShift) — all directly applicable to Azure DevOps, Azure Pipelines, Terraform on Azure, and AKS orchestration.`,
    competencies: ['Azure DevOps · Azure Pipelines · AKS Patterns', 'GitHub Actions · GitLab CI/CD · Jenkins', 'Terraform IaC — AWS &amp; Azure', 'Kubernetes (EKS/OpenShift)', 'Docker · Helm · ArgoCD', 'Python · Bash Scripting', 'Prometheus · Grafana · ELK', 'Linux System Administration', 'Secrets Management (Vault · Secrets Manager)', 'CI/CD Quality Gates (SonarQube)'],
    expBullets: ['cicd', 'azure', 'k8s', 'iac', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: true, azure_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 16 — Astra Security | DevOps Engineer - Cloud & Infra Automation
  {
    slug: '16-astra-security-devops',
    title: 'DevOps Engineer — Cloud & Infra Automation',
    summary: `DevOps Engineer with <strong>1.4 years of production cloud infrastructure and security automation experience</strong>. Promoted from Intern to full-time within 5 months. Implemented security-hardened CI/CD pipelines with SonarQube quality gates, managed <strong>HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, and Trivy</strong> container scanning across production environments. Built Terraform IaC (34 modules) with 95% configuration drift reduction and IAM least-privilege scoping — directly aligned with Astra Security's cloud security and infrastructure automation mission.`,
    competencies: ['Cloud Security Automation — IAM · KMS · TLS/SSL', 'HashiCorp Vault · Secrets Manager · Sealed Secrets', 'Trivy Container Scanning · SonarQube Quality Gates', 'Terraform IaC (95% drift reduction)', 'CI/CD Pipeline Security (Jenkins · GitHub Actions)', 'Kubernetes (EKS, OpenShift) · Docker', 'AWS Infrastructure Security', 'Python · Bash Security Automation', 'Linux System Hardening', 'Prometheus · Grafana · ELK · Incident Response'],
    expBullets: ['security', 'iac', 'cicd', 'automation', 'k8s'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cloud') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 17 — Moonfrog Labs | DevOps Engineer II — Bangalore (gaming, AWS/K8s)
  {
    slug: '17-moonfrog-devops-ii',
    title: 'DevOps Engineer II',
    summary: `DevOps Engineer with <strong>1.4 years of production-grade experience</strong> in CI/CD automation, Kubernetes operations, and AWS cloud infrastructure — now bringing that expertise to high-scale gaming infrastructure. Promoted from Intern to full-time within 5 months. Operated multi-tenant <strong>EKS clusters at 99.9% uptime</strong> with ArgoCD GitOps and Karpenter autoscaling, built 40+ CI/CD pipelines cutting release cycles 82%, and reduced compute costs by 30% via intelligent node scaling — critical for gaming workloads with variable traffic spikes.`,
    competencies: ['Kubernetes EKS · Karpenter Autoscaling · KEDA', 'CI/CD Automation (Jenkins · GitHub Actions · GitLab CI/CD)', 'AWS Infrastructure · Cost Optimisation (30% reduction)', 'ArgoCD GitOps · Helm · Istio', 'Terraform IaC', 'Python · Bash Automation', 'Prometheus · Grafana · Datadog', 'Linux Administration · Incident Response', 'Docker · Container Orchestration', 'Zero-Downtime Deployments'],
    expBullets: ['k8s', 'cost', 'cicd', 'iac', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.healthcare() + PROJECTS.serverless(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 18 — CredFlow AI | DevOps Engineer — Gurgaon (fintech AI startup)
  {
    slug: '18-credflow-ai-devops',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production experience</strong> in CI/CD automation, cloud infrastructure, and Kubernetes orchestration — eager to drive rapid infrastructure growth at an AI fintech startup. Promoted from Intern to full-time within 5 months. Built 40+ CI/CD pipelines cutting release cycles by 82%, operated EKS clusters at 99.9% uptime, and automated 70% of operational toil through Python/Bash scripting. Strong fit for startup pace: owns end-to-end infrastructure autonomously, iterates fast, and has led real-world AWS deployments across Lambda, EKS, RDS, and VPC in production.`,
    competencies: ['CI/CD Pipelines (Jenkins · GitLab CI/CD · GitHub Actions)', 'Kubernetes EKS · Docker · Helm · ArgoCD', 'AWS Full Stack (EKS, Lambda, RDS, S3, VPC)', 'Terraform IaC · Self-Service Infrastructure', 'Python · Bash Automation (70% toil reduction)', 'Startup Pace · End-to-End Ownership', 'Prometheus · Grafana · ELK · Datadog', 'Linux Administration · Incident RCA', 'IAM · Secrets Manager · Vault', 'Zero-Downtime Deployments'],
    expBullets: ['cicd', 'automation', 'k8s', 'iac', 'observability'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cicd') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 19 — TransUnion | DevOps Engineer — India
  {
    slug: '19-transunion-devops',
    title: 'DevOps Engineer',
    summary: `DevOps Engineer with <strong>1.4 years of production experience</strong> delivering secure, reliable CI/CD infrastructure and cloud operations in data-sensitive environments. Promoted from Intern to full-time within 5 months. Built 40+ CI/CD pipelines with SonarQube quality gates — cutting release cycles by 82%. Operated multi-AZ EKS clusters at 99.9% uptime with ArgoCD GitOps, managed security hardening (HashiCorp Vault, Sealed Secrets, Trivy, IAM least-privilege), and provisioned Terraform IaC achieving 95% drift reduction — aligned with TransUnion's data security and reliability requirements.`,
    competencies: ['CI/CD Pipelines with Security Gates (SonarQube)', 'Kubernetes EKS · ArgoCD GitOps · Helm', 'Terraform IaC (95% configuration drift reduction)', 'AWS Infrastructure (EKS, EC2, RDS, VPC, S3)', 'Security — Vault · Secrets Manager · Trivy · IAM', 'Python · Bash Automation', 'Prometheus · Grafana · ELK Observability', 'Linux Administration · Incident RCA', 'Docker · Istio Service Mesh', 'Multi-AZ High Availability'],
    expBullets: ['cicd', 'security', 'iac', 'k8s', 'automation'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('cloud') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: true }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 20 — Nexthink | Platform Software Engineer - SRE — Bangalore
  {
    slug: '20-nexthink-platform-sre',
    title: 'Platform Software Engineer — SRE',
    summary: `Platform SRE Engineer with <strong>1.4 years of production experience</strong> at the intersection of platform engineering and site reliability — building developer-enabling infrastructure, sustaining 99.9% uptime, and eliminating operational toil through automation. Promoted from Intern to full-time within 5 months. Designed Terraform IaC (34 reusable modules) for self-service infrastructure provisioning, operated Kubernetes (EKS, OpenShift) clusters with ArgoCD GitOps, built unified observability (Prometheus, Grafana, ELK, Datadog), and reduced recurring toil by 70% through Python/Bash automation — core platform SRE outcomes.`,
    competencies: ['Platform Engineering — Terraform IaC Self-Service', 'Kubernetes (EKS, OpenShift) · ArgoCD · Helm · Karpenter', 'SRE — 99.9% Uptime · Incident RCA · Runbooks', 'Prometheus · Grafana · Loki · ELK · Datadog', 'Python · Bash Automation (70% toil reduction)', 'CI/CD Developer Enablement (Jenkins · GitHub Actions)', 'AWS Infrastructure · Multi-Region DR (RPO &lt; 1h)', 'Linux System Administration', 'IAM · HashiCorp Vault · Secrets Manager', 'Post-Mortems · SLO Definition &amp; Tracking'],
    expBullets: ['k8s', 'observability', 'automation', 'iac', 'dr'],
    internBullets: ['monitoring', 'promotion'],
    projects: PROJECTS.crm('sre') + PROJECTS.serverless() + PROJECTS.healthcare(),
    skills: buildSkills({ cicd_first: false }),
  },

];

// ─── GENERATE ALL RESUMES ─────────────────────────────────────────────────────
let generated = 0;
for (const job of JOBS) {
  const html = buildHTML(job);
  const outPath = resolve(__dirname, 'output', `${job.slug}.html`);
  writeFileSync(outPath, html, 'utf8');
  console.log(`✅ Generated: output/${job.slug}.html`);
  generated++;
}

console.log(`\n🎉 Done! Generated ${generated} tailored resume HTML files in output/`);
console.log(`\nTo generate PDFs, run:`);
JOBS.forEach(job => {
  console.log(`  node generate-pdf.mjs output/${job.slug}.html output/${job.slug}.pdf`);
});
