# Uday Varmora

+91 96623 85170 | varmorauday1045@gmail.com | [linkedin.com/in/udayvarmora](https://linkedin.com/in/udayvarmora) | [github.com/udayvarmora07](https://github.com/udayvarmora07) | Ahmedabad, India

---

## Professional Summary
DevOps Engineer with **1+ year** operating and extending production **AWS, Kubernetes (EKS), and CI/CD** systems across **20+ Dockerised microservices** — cutting compute cost **30% ($500+/month)**, eliminating **~70% of operational toil**, and sustaining **99.9% uptime**. Executed a zero-downtime **EKS upgrade (v1.33 → v1.34)** and built multi-region disaster recovery (**RPO < 1 hr**). Hands-on with **Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, Docker, EKS, Terraform, Ansible, ArgoCD, Prometheus/Grafana/Loki, HashiCorp Vault, Python/Bash**.

---

## Technical Skills
* **Scripting & OS:** Python, Bash/Shell, Linux (Ubuntu, Amazon Linux, RHEL), System Administration
* **CI/CD & GitOps:** Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, AWS CodeBuild, ArgoCD
* **Containers & Orchestration:** Docker, Kubernetes (EKS), Helm, Karpenter, KEDA, Ingress-NGINX
* **Infrastructure as Code:** Terraform, Ansible, AWS CloudFormation, AWS SAM
* **Cloud Platform:** AWS (EKS, EC2, Lambda, S3, ECR, RDS, VPC, IAM, KMS, CloudWatch)
* **Observability & Monitoring:** Prometheus, Grafana, Loki, Grafana Alloy, CloudWatch
* **Security & Secrets:** HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, Trivy Operator, IAM, KMS, TLS/SSL
* **Version Control:** Git, GitHub, Bitbucket, Branching Strategies

---

## Professional Experience

### DevOps Engineer | eSparkBiz
*Ahmedabad, India | Jun 2025 – Apr 2026*
* Built and maintained **40+ CI/CD pipelines** using **Jenkins, GitLab CI/CD, GitHub Actions, AWS CodePipeline, and AWS CodeBuild** — automating build-test-deploy across **20+ Dockerised microservices**, including pipelines for new services added to the platform; sustaining fast, automated (**~8-minute**) deployments.
* Maintained and extended multi-environment AWS infrastructure on **Linux (Ubuntu, Amazon Linux, RHEL)** using **Terraform IaC** (34 reusable modules, S3 remote state, DynamoDB locking) — delivering consistent, reproducible provisioning across Dev, Staging, and Production.
* Reduced AWS compute costs by **30% ($500+/month)** via **Karpenter** Spot/On-Demand diversification, **KEDA** off-hours scale-down, and a **Kubernetes CronJob** that scales non-prod environments down overnight — preserving availability while improving cluster utilization.
* Operated **Kubernetes (EKS)** clusters with **ArgoCD GitOps, Helm, and Ingress-NGINX** — managing zero-downtime rollouts, Karpenter autoscaling, and KEDA event-driven scaling; executed a zero-downtime **EKS upgrade (v1.33 → v1.34)**; sustained **99.9% uptime** across multi-AZ clusters.
* Developed **Python and Bash** automation to eliminate **~70% of recurring operational toil** — cluster operations, log triage, secret rotation, scheduled scaling (non-prod CronJob), and pipeline scripting.

### DevOps Engineer Intern | eSparkBiz
*Ahmedabad, India | Jan 2025 – May 2025*
* Built and maintained AWS infrastructure monitoring on **Linux-based environments**, configured CloudWatch dashboards, and triaged production incidents across Kubernetes workloads; authored operational runbooks for recurring issue patterns and root-cause analyses.
* Wrote **Python and Bash** automation scripts to streamline deployment workflows and reduce manual operational steps — demonstrated ownership and impact, earning **full-time promotion within 5 months**.

---

## Key Projects

### Cloud-Native SaaS CRM Platform — Multi-Tenant AWS / EKS
*Terraform · AWS EKS · Docker · GitHub Actions · AWS CodeBuild · ArgoCD · Karpenter · KEDA · Ingress-NGINX · Prometheus · Grafana · Loki*
* Operated and extended a multi-environment AWS/EKS platform (per-environment **VPC isolation**, S3/DynamoDB remote state, Ingress-NGINX Controller); executed a zero-downtime **EKS cluster upgrade (v1.33 → v1.34)** — managing node group rollouts, add-on compatibility, and API deprecation remediation.
* Reduced compute costs by **30% ($500+/month)** via Karpenter Spot/On-Demand diversification, KEDA off-hours scale-down, and a non-prod scheduling **CronJob**; migrated deprecated loki-stack to **Loki + Grafana Alloy**, improving log pipeline reliability.
* Built a multi-region **disaster recovery strategy** using Velero (with EBS snapshot Data Mover), S3/ECR cross-region replication, and AWS Backup with cross-region vaults — achieving **RPO < 1 hour** for production workloads.

### Serverless Backend — Multi-Tenant Salon Management SaaS
*AWS Lambda · SAM · CloudFormation · API Gateway · RDS PostgreSQL · Amazon EFS · Secrets Manager · Python*
* Maintained and extended a serverless backend of **6 nested SAM/CloudFormation templates** and **30+ Python Lambda functions** — handling deployments, reproducible packaging, and per-function least-privilege IAM.
* Hit the **250MB Lambda deployment-package limit** during SAM build — diagnosed the constraint and engineered a shared **EFS-mounted Python dependency layer** across 30+ functions, eliminating packaging bottlenecks and cutting build times by **60%+**.

### Healthcare Management System — Cloud Infrastructure & CI/CD (Proof-of-Concept)
*AWS S3 · CloudFront · App Runner · ECR · Docker · GitHub Actions · GHCR · Secrets Manager · IAM*
* Co-built a split-hosting proof-of-concept (S3/CloudFront frontend, Dockerised App Runner backend) with a **dual-registry GHCR/ECR strategy** — demonstrating zero-downtime redeployment for client review.
* Built the release workflow via **GitHub Actions** — Docker build, ECR/GHCR dual-push, S3 sync, CloudFront invalidation, and App Runner deploy — with least-privilege IAM scoping.

---

## Education
* **B.Tech, Information Technology** — Dharmsinh Desai University, Gujarat, India (2021 – 2025) | *CGPA: 7.25 / 10*

---

## Achievements
* Awarded **“Student of the Year”** in Class 10 for outstanding academic performance and leadership contributions.
