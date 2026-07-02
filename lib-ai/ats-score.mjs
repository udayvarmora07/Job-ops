/**
 * lib-ai/ats-score.mjs — deterministic, reproducible ATS keyword-match score.
 *
 * The web dashboard used to show an "ATS X/100" that was actually an LLM's
 * holistic opinion: no formula, ±16-point run-to-run variance, and it leaked
 * out-of-range values. This computes a real ATS score in code, the same way an
 * applicant-tracking system screens a résumé — by keyword coverage of the JD —
 * so the number is identical every time for the same inputs and is fully
 * explainable (you can see exactly which keywords matched and which are missing).
 *
 * Rubric (mirrors modes/ats.md):
 *   score = round( matchedWeight / totalWeight × 100 ) − penalties, clamped 0–100
 *   weight: a JD keyword is "required" (3 pts) if it appears ≥2× OR next to a
 *           requirement cue ("required", "must have", "strong", …); else 1 pt.
 *   penalty: −5 if any keyword is stuffed into the résumé (appears ≥5×).
 *
 * Domain dictionary is DevOps/SRE/Platform/Cloud (the user's field). It's a
 * plain data table below — edit it to add terms or retarget another domain.
 */

// Canonical skill/tech vocabulary. Each entry: canonical name + optional aliases.
// Only these terms are treated as "keywords" — this is what stops stopwords and
// generic prose from polluting the score. Matching is case-insensitive and
// word-boundary aware; aliases fold into the canonical term (k8s == Kubernetes).
const SKILLS = [
  // Cloud platforms & services
  ['AWS', ['amazon web services']], ['Azure', ['microsoft azure']], ['GCP', ['google cloud', 'google cloud platform']],
  ['EC2'], ['S3'], ['Lambda'], ['EKS'], ['AKS'], ['GKE'], ['RDS'], ['DynamoDB'], ['CloudFormation'],
  ['CloudWatch'], ['IAM'], ['VPC'], ['Route53', ['route 53']], ['Fargate'], ['ECS'], ['SQS'], ['SNS'], ['EBS'],
  // Containers & orchestration
  ['Docker'], ['Kubernetes', ['k8s']], ['Helm'], ['OpenShift'], ['containerd'], ['Podman'], ['Istio'], ['service mesh'],
  // Infrastructure as Code
  ['Terraform'], ['Ansible'], ['Pulumi'], ['Chef'], ['Puppet'], ['Vagrant'], ['Packer'], ['ARM templates'], ['Bicep'],
  // CI/CD
  ['Jenkins'], ['GitLab CI', ['gitlab ci/cd']], ['GitHub Actions'], ['CircleCI'], ['ArgoCD', ['argo cd']],
  ['Flux'], ['Spinnaker'], ['Tekton'], ['TeamCity'], ['Bamboo'], ['Azure Pipelines', ['azure devops']],
  ['CI/CD', ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment']], ['GitOps'],
  // Observability & monitoring
  ['Prometheus'], ['Grafana'], ['Datadog'], ['New Relic'], ['Splunk'], ['ELK', ['elk stack']],
  ['Elasticsearch'], ['Logstash'], ['Kibana'], ['Loki'], ['Jaeger'], ['OpenTelemetry', ['otel']],
  ['PagerDuty'], ['Nagios'], ['Zabbix'], ['Dynatrace'], ['AppDynamics'],
  // Languages & scripting
  ['Python'], ['Bash', ['shell scripting', 'shell']], ['Go', ['golang']], ['Groovy'], ['PowerShell'],
  ['Ruby'], ['Perl'], ['YAML'], ['Java'], ['Node.js', ['nodejs', 'node js']], ['JavaScript'],
  // Config, secrets, messaging, data
  ['Vault', ['hashicorp vault']], ['Consul'], ['Kafka'], ['RabbitMQ'], ['Redis'], ['PostgreSQL', ['postgres']],
  ['MySQL'], ['MongoDB'], ['Cassandra'],
  // Networking & security
  ['Nginx'], ['HAProxy'], ['DNS'], ['TLS'], ['SSL'], ['Load Balancer', ['load balancing']], ['WAF'],
  ['VPN'], ['RBAC'], ['DevSecOps'], ['SAST'], ['DAST'], ['firewall'],
  // OS & version control
  ['Linux'], ['Unix'], ['RHEL', ['red hat']], ['Ubuntu'], ['CentOS'], ['Git'], ['GitHub'], ['GitLab'], ['Bitbucket'],
  // Practices & concepts
  ['SRE', ['site reliability']], ['DevOps'], ['Microservices'], ['Infrastructure as Code', ['iac']],
  ['SLA'], ['SLO'], ['SLI'], ['high availability', ['ha']], ['disaster recovery', ['dr']],
  ['blue-green', ['blue green']], ['canary'], ['autoscaling', ['auto-scaling', 'auto scaling']],
  ['incident management', ['incident response', 'on-call', 'on call']], ['Agile'], ['Scrum'], ['Jira'],
  ['scalability'], ['automation'],
];

const REQUIRE_CUES = /\b(required|require|must[\s-]?have|must\b|essential|strong|proficient|expert(ise)?|deep|solid|extensive|mandatory)\b/i;

/** Escape a term for use inside a RegExp. */
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a matcher for a term. Uses \b boundaries where the term is
 * word-char-bounded; for terms with symbols (CI/CD, Node.js, C++) it anchors on
 * non-word or string edges so "CI/CD" matches but doesn't require a trailing \b.
 */
function termRegex(term) {
  const e = esc(term);
  const startsWord = /^\w/.test(term);
  const endsWord = /\w$/.test(term);
  const left = startsWord ? '(?<![\\w])' : '';
  const right = endsWord ? '(?![\\w])' : '';
  return new RegExp(`${left}${e}${right}`, 'gi');
}

/** Count non-overlapping occurrences of a term in text. */
function countOccurrences(text, term) {
  const m = text.match(termRegex(term));
  return m ? m.length : 0;
}

/** True if term (or any alias) occurs at least once in text. */
function present(text, canonical, aliases) {
  if (countOccurrences(text, canonical) > 0) return true;
  return aliases.some((a) => countOccurrences(text, a) > 0);
}

/** Total occurrences of a canonical term OR its aliases. */
function totalCount(text, canonical, aliases) {
  return [canonical, ...aliases].reduce((n, t) => n + countOccurrences(text, t), 0);
}

/**
 * Flatten a résumé (object or string) into one plain-text blob for matching —
 * collects every string value recursively so skills, bullets, projects, and
 * summary all count, without JSON punctuation noise.
 */
export function resumeToText(resume) {
  if (resume == null) return '';
  if (typeof resume === 'string') return resume;
  const parts = [];
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') parts.push(v);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(resume);
  return parts.join('\n');
}

/**
 * Compute a deterministic ATS keyword-match score.
 *
 * @param {string} jd                 the target job description
 * @param {object|string} resume      résumé content (object or text)
 * @param {object} [opts]
 * @param {number} [opts.minKeywords] JD must yield at least this many keywords,
 *                                    else the score is null (too sparse to score)
 * @returns {{score:number|null, basis:'keyword-match', reason?:string,
 *            coverage:number, requiredHit:number, requiredTotal:number,
 *            matched:Array, missing:Array, penalties:number, keywordCount:number}}
 */
export function computeAtsScore(jd, resume, opts = {}) {
  const minKeywords = opts.minKeywords ?? 4;
  const jdText = String(jd || '');
  const resumeText = resumeToText(resume);

  // 1. Which dictionary keywords appear in the JD? Those are what an ATS screens for.
  const keywords = [];
  for (const [canonical, aliases = []] of SKILLS) {
    const freq = totalCount(jdText, canonical, aliases);
    if (freq === 0) continue;
    // required (3 pts) if it recurs or sits next to a requirement cue; else preferred (1 pt).
    const near = nearRequireCue(jdText, canonical, aliases);
    const weight = freq >= 2 || near ? 3 : 1;
    keywords.push({ term: canonical, aliases, weight, jdFreq: freq });
  }

  if (keywords.length < minKeywords) {
    return {
      score: null,
      basis: 'keyword-match',
      reason: `JD yielded only ${keywords.length} recognizable keyword(s) — too sparse for a reliable ATS score`,
      coverage: 0,
      requiredHit: 0,
      requiredTotal: keywords.filter((k) => k.weight === 3).length,
      matched: [],
      missing: [],
      penalties: 0,
      keywordCount: keywords.length,
    };
  }

  // 2. Match each JD keyword against the résumé.
  let totalWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];
  let requiredTotal = 0;
  let requiredHit = 0;
  for (const k of keywords) {
    totalWeight += k.weight;
    if (k.weight === 3) requiredTotal++;
    const hit = present(resumeText, k.term, k.aliases);
    if (hit) {
      matchedWeight += k.weight;
      if (k.weight === 3) requiredHit++;
      matched.push({ term: k.term, weight: k.weight });
    } else {
      missing.push({ term: k.term, weight: k.weight });
    }
  }

  // 3. Keyword-stuffing penalty: any dictionary term jammed into the résumé ≥5×.
  let penalties = 0;
  const stuffed = [];
  for (const k of matched) {
    const entry = SKILLS.find(([c]) => c === k.term);
    const aliases = entry ? entry[1] || [] : [];
    if (totalCount(resumeText, k.term, aliases) >= 5) {
      stuffed.push(k.term);
    }
  }
  if (stuffed.length > 0) penalties += 5;

  const rawCoverage = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0;
  const score = Math.round(Math.max(0, Math.min(100, rawCoverage - penalties)));

  return {
    score,
    basis: 'keyword-match',
    coverage: Math.round(rawCoverage),
    requiredHit,
    requiredTotal,
    matched: matched.sort((a, b) => b.weight - a.weight),
    missing: missing.sort((a, b) => b.weight - a.weight),
    penalties,
    stuffed,
    keywordCount: keywords.length,
  };
}

/** Is any occurrence of the term within ~60 chars of a requirement cue in the JD? */
function nearRequireCue(jdText, canonical, aliases) {
  for (const term of [canonical, ...aliases]) {
    const re = termRegex(term);
    let m;
    while ((m = re.exec(jdText)) !== null) {
      const from = Math.max(0, m.index - 60);
      const window = jdText.slice(from, m.index + term.length + 60);
      if (REQUIRE_CUES.test(window)) return true;
    }
  }
  return false;
}
