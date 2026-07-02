const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, TabStopType,
  ExternalHyperlink
} = require('docx');
 
// ========== STYLE CONSTANTS ==========
const FONT = "Calibri";
const NAVY = "1B3A6B";
const BLACK = "000000";
const DARK_GRAY = "333333";
 
// Sizes (half-points)
const SZ_NAME = 32;        // 16pt
const SZ_HEADER = 22;      // 11pt
const SZ_BODY = 20;        // 10pt
const SZ_CONTACT = 20;     // 10pt  ← personal info line
const SZ_SKILLS = 20;      // 10pt  ← skills body text
const SZ_PROJECT_TECH = 19; // 9.5pt (per user request)
 
// Spacing (twips)
const LINE = 211;
const SECTION_BEFORE = 24;
const SECTION_AFTER = 16;
const BULLET_BEFORE = 8;
const SUB_HEADER_BEFORE = 20;
 
// ========== HELPERS ==========
function r(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size || SZ_BODY,
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: opts.color || BLACK,
  });
}
 
function b(text, opts = {}) {
  return r(text, { ...opts, bold: true });
}
 
function link(url, displayText, opts = {}) {
  return new ExternalHyperlink({
    link: url,
    children: [
      new TextRun({
        text: displayText,
        font: FONT,
        size: opts.size || SZ_CONTACT,
        color: opts.color || DARK_GRAY,
      })
    ],
  });
}
 
function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: SECTION_BEFORE, after: SECTION_AFTER, line: LINE, lineRule: "exact" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 1 } },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: FONT,
        size: SZ_HEADER,
        bold: true,
        color: NAVY,
      })
    ],
  });
}
 
function bullet(runs, opts = {}) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: {
      before: opts.before !== undefined ? opts.before : BULLET_BEFORE,
      after: opts.after || 0,
      line: LINE,
      lineRule: "exact"
    },
    children: Array.isArray(runs) ? runs : [r(runs)],
  });
}
 
function p(runs, opts = {}) {
  return new Paragraph({
    spacing: {
      before: opts.before || 0,
      after: opts.after || 0,
      line: LINE,
      lineRule: "exact"
    },
    alignment: opts.alignment,
    children: Array.isArray(runs) ? runs : [r(runs)],
  });
}
 
function skillRow(category, items) {
  return p([
    b(category + ": ", { color: BLACK, size: SZ_SKILLS }),
    r(items, { size: SZ_SKILLS }),
  ], { before: 0 });
}
 
function jobHeader(left, right) {
  return new Paragraph({
    spacing: { before: 80, after: 0, line: LINE, lineRule: "exact" },
    tabStops: [{ type: TabStopType.RIGHT, position: 10800 }],
    children: [
      ...left,
      r("\t"),
      ...right,
    ],
  });
}
 
const doc = new Document({
  creator: "Uday Varmora",
  title: "Uday Varmora - DevOps Engineer Resume",
  styles: {
    default: { document: { run: { font: FONT, size: SZ_BODY, color: BLACK } } },
  },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 252, hanging: 252 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 500, right: 720, bottom: 500, left: 720 },
      },
    },
    children: [
      // HEADER
      new Paragraph({
        spacing: { before: 0, after: 60, line: LINE, lineRule: "exact" },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "UDAY VARMORA", font: FONT, size: SZ_NAME, bold: true, color: NAVY }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0, line: LINE, lineRule: "exact" },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "+91 96623 85170 | ", font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
          link("mailto:varmorauday1045@gmail.com", "varmorauday1045@gmail.com"),
          new TextRun({ text: " | ", font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
          link("https://linkedin.com/in/udayvarmora", "linkedin.com/in/udayvarmora"),
          new TextRun({ text: " | ", font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
          link("https://github.com/udayvarmora07", "github.com/udayvarmora07"),
          new TextRun({ text: " | Ahmedabad, India", font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
        ],
      }),
 
      // PROFESSIONAL SUMMARY
      sectionHeader("Professional Summary"),
      p([
        r("DevOps Engineer with "),
        b("1+ year"),
        r(" building "),
        b("CI/CD pipelines and Linux-based cloud-native infrastructure"),
        r(" — cutting release cycles "),
        b("82% (45 → 8 min)"),
        r(", provisioning "),
        b("80%"),
        r(", and toil "),
        b("70%"),
        r(" across 20+ services. Hands-on with "),
        b("Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, Docker, Kubernetes (EKS, OpenShift), Terraform, Istio, ELK Stack, Datadog, HashiCorp Vault, Python/Bash"),
        r("."),
      ]),
 
      // TECHNICAL SKILLS
      sectionHeader("Technical Skills"),
      skillRow("Scripting & OS", "Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration"),
      skillRow("CI/CD & GitOps", "Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD"),
      skillRow("Containers & Service Mesh", "Docker, Kubernetes (EKS, OpenShift), Helm, Istio, Karpenter, KEDA, Ingress-NGINX"),
      skillRow("Infrastructure as Code", "Terraform, AWS CloudFormation, AWS SAM, Ansible"),
      skillRow("Cloud Platforms", "AWS — EKS, EC2, Lambda, S3, ECR, RDS, VPC, CloudWatch; Azure (Fundamentals)"),
      skillRow("Observability & Monitoring", "Prometheus, Grafana, Loki, ELK Stack, Datadog, CloudWatch"),
      skillRow("Security & Secrets", "HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL"),
      skillRow("Version Control & Code Review", "Git, GitHub, Bitbucket, Gerrit, Branching Strategies"),
 
      // PROFESSIONAL EXPERIENCE
      sectionHeader("Professional Experience"),
      jobHeader(
        [b("DevOps Engineer"), r("  |  eSparkBiz · Ahmedabad, India", { color: DARK_GRAY })],
        [r("Jun 2025 – Apr 2026")]
      ),
      bullet([
        r("Designed and maintained "),
        b("40+ CI/CD pipelines"),
        r(" using "),
        b("Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, and AWS CodeBuild"),
        r(" — automating build-test-deploy workflows across "),
        b("20+ Dockerised microservices"),
        r(", cutting release cycles by "),
        b("82% (45 min → under 8 min)"),
        r(" with zero manual intervention."),
      ]),
      bullet([
        r("Provisioned multi-environment AWS infrastructure on "),
        b("Linux (Ubuntu, Amazon Linux, RHEL)"),
        r(" using "),
        b("Terraform IaC"),
        r(" (34 reusable modules, S3 remote state, DynamoDB locking) — reducing provisioning time by "),
        b("80%"),
        r(" and configuration drift by "),
        b("95%"),
        r(" across Dev, Staging, and Production environments."),
      ]),
      bullet([
        r("Operated "),
        b("Kubernetes (EKS, OpenShift)"),
        r(" clusters with "),
        b("ArgoCD GitOps, Helm, Istio service mesh, and Ingress-NGINX Controller"),
        r(" — managing zero-downtime rollouts, Karpenter node autoscaling, and KEDA event-driven scaling; sustained "),
        b("99.9% uptime"),
        r(" across multi-AZ clusters."),
      ]),
      bullet([
        r("Drove "),
        b("root-cause analysis"),
        r(" for "),
        b("Linux-based production incidents"),
        r(" across CPU, memory, network, and container runtime; built observability with "),
        b("Prometheus, Grafana, Loki, ELK Stack, and Datadog"),
        r("; authored runbooks and post-incident reviews."),
      ]),
      bullet([
        r("Developed "),
        b("Python and Bash"),
        r(" automation to eliminate "),
        b("~70% of recurring operational toil"),
        r(" — covering cluster operations, log triage, secret rotation, and pipeline scripting; integrated SonarQube quality gates and "),
        b("Git/Gerrit"),
        r(" code-review workflows into CI/CD."),
      ]),
      jobHeader(
        [b("DevOps Engineer Intern"), r("  |  eSparkBiz · Ahmedabad, India", { color: DARK_GRAY })],
        [r("Jan 2025 – May 2025")]
      ),
      bullet([
        r("Built and maintained AWS infrastructure monitoring on "),
        b("Linux-based environments"),
        r(", configured CloudWatch dashboards, and triaged production incidents across Kubernetes workloads; authored operational runbooks for recurring issue patterns and root-cause analyses."),
      ]),
      bullet([
        r("Wrote "),
        b("Python and Bash"),
        r(" automation scripts to streamline deployment workflows and reduce manual operational steps — demonstrated ownership and impact, earning "),
        b("full-time promotion within 5 months"),
        r("."),
      ]),
 
      // KEY PROJECTS
      sectionHeader("Key Projects"),
 
      p([b("Cloud-Native SaaS CRM Platform — Multi-Tenant AWS / EKS Build & Deploy Infrastructure")], { before: SUB_HEADER_BEFORE }),
      p([r("Terraform · AWS EKS · Docker · Jenkins · GitLab CI/CD · GitHub Actions · AWS CodePipeline · ArgoCD · Ingress-NGINX · Prometheus · Grafana", { italics: true, size: SZ_PROJECT_TECH, color: DARK_GRAY })], { before: 0 }),
      bullet([
        r("Designed multi-environment build/deploy architecture with per-environment "),
        b("VPC isolation and S3/DynamoDB remote state"),
        r(" — enabling reproducible Dev/Production infrastructure on Linux-based EKS nodes with "),
        b("Ingress-NGINX Controller"),
        r("; executed zero-downtime "),
        b("EKS cluster upgrade (v1.33 → v1.34)"),
        r(" managing node group rollouts, add-on compatibility, and API deprecation remediation."),
      ]),
      bullet([
        r("Reduced compute costs by "),
        b("30% ($500+/month)"),
        r(" via Karpenter Spot/On-Demand diversification and KEDA off-hours scale-down; migrated deprecated loki-stack to Loki + Grafana Alloy, eliminating deprecated chart dependencies and improving log pipeline reliability."),
      ]),
      bullet([
        r("Built multi-region "),
        b("disaster recovery strategy"),
        r(" using Velero (with EBS snapshot Data Mover), S3/ECR cross-region replication, and AWS Backup with cross-region vaults — achieving "),
        b("RPO < 1 hour"),
        r(" for production workloads."),
      ]),
 
      p([b("Serverless Backend — Multi-Tenant Salon Management SaaS")], { before: SUB_HEADER_BEFORE }),
      p([r("AWS Lambda · SAM · CloudFormation · API Gateway · RDS PostgreSQL · Amazon EFS · Secrets Manager · Python", { italics: true, size: SZ_PROJECT_TECH, color: DARK_GRAY })], { before: 0 }),
      bullet([
        r("Architected a serverless build/deploy system using "),
        b("6 nested SAM/CloudFormation templates"),
        r(" with SAM build pipelines — enabling independent deployment of "),
        b("30+ Python Lambda functions"),
        r(" with reproducible packaging and per-function least-privilege IAM."),
      ]),
      bullet([
        r("Solved Lambda layer size constraints by engineering a shared "),
        b("EFS-mounted Python dependency layer"),
        r(" across 30+ functions — eliminating packaging bottlenecks and cutting build times by "),
        b("60%+"),
        r("."),
      ]),
 
      p([b("Healthcare Management System — Cloud Infrastructure & CI/CD")], { before: SUB_HEADER_BEFORE }),
      p([r("AWS S3 · CloudFront · App Runner · ECR · Docker · GitHub Actions · Secrets Manager · IAM", { italics: true, size: SZ_PROJECT_TECH, color: DARK_GRAY })], { before: 0 }),
      bullet([
        r("Engineered split-hosting (S3/CloudFront frontend, Dockerised App Runner backend) with a "),
        b("dual-registry GHCR/ECR strategy"),
        r(" — enabling zero-downtime redeployments and "),
        b("~30% reduced image pull latency"),
        r(" while serving 500+ concurrent users."),
      ]),
      bullet([
        r("Automated full release workflow via "),
        b("GitHub Actions"),
        r(" — Docker build, ECR/GHCR dual-push, S3 sync, CloudFront invalidation, and App Runner deploy; applied least-privilege IAM scoping that removed 5+ overly permissive roles."),
      ]),
 
      // EDUCATION
      sectionHeader("Education"),
      jobHeader(
        [b("B.Tech, Information Technology"), r(" — Dharmsinh Desai University, Gujarat, India  |  CGPA: 7.25 / 10")],
        [r("2021 – 2025")]
      ),
 
      // ACHIEVEMENTS
      sectionHeader("Achievements"),
      bullet([
        r("Awarded "),
        b("\u201CStudent of the Year\u201D"),
        r(" in Class 10 for outstanding academic performance and leadership contributions."),
      ], { before: 0 }),
    ],
  }],
});
 
Packer.toBuffer(doc).then(buffer => {
  const outPath = "/mnt/user-data/outputs/Uday_Varmora_DevOps_Resume_Universal.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Resume created: " + outPath);
});
