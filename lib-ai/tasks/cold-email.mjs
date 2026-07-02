/**
 * lib-ai/tasks/cold-email.mjs — compose a cold outreach email to a decision-maker.
 *
 * Two modes:
 *   jd_specific  — there is a live opening; apply directly, résumé attached.
 *   speculative  — no current opening; politely ask if they're hiring (or will be)
 *                  for the candidate's target roles, résumé attached just in case.
 *
 * Hard rules come from email-finder-roadmap/SENDER_SAFETY.md §5 (content discipline):
 * short, plain, honest subject, one CTA, one attachment, real metrics only, soft
 * opt-out. The output is parsed by the caller into { subject, body }.
 *
 * An optional `template` (one of the 5 archetypes from lib-outreach/templates.mjs)
 * shapes the email's structure for A/B testing. It is passed in as a plain object
 * so this module stays independent of lib-outreach. `workMode` ("remote"/"hybrid"/
 * "onsite") flips on the template's remote-vs-India tuning.
 */

import { read, candidateContext, candidateContact, candidateSignature, CLI_RULES } from '../context.mjs';

export function buildColdEmail(input = {}) {
  const {
    company = '', role = '', personName = '', personTitle = '',
    jd = '', mode = 'jd_specific', template = null, workMode = '',
  } = typeof input === 'string' ? { jd: input } : input;

  if (!company && !jd) {
    throw new Error('buildColdEmail: provide at least a company (and ideally role + person).');
  }
  const m = mode === 'speculative' ? 'speculative' : 'jd_specific';

  // Optional template archetype + market tuning (India by default; remote tuning
  // when the post is remote). Empty string when no template is supplied.
  const isRemote = workMode === 'remote' || workMode === 'hybrid';
  const templateBlock = template
    ? `
TEMPLATE TO FOLLOW — write the email in THIS archetype's shape (id: ${template.id}):
${template.structure}

MARKET TUNING — INDIA (apply unless it conflicts with the structure above):
${template.indiaNotes}
${isRemote ? `MARKET TUNING — REMOTE ROLE (this post is ${workMode}):\n${template.remoteNotes}` : ''}
`
    : '';

  // Extra metrics source for this user (safe no-op for generic users).
  const masterBrief = read('uday-data/01_MASTER_BRIEF.md', 'MASTER_BRIEF');

  const modeRules = m === 'speculative'
    ? `MODE: SPECULATIVE (no posted opening).
- The goal is a soft, respectful inquiry: ask whether they have — or expect to have —
  openings for the candidate's target roles (DevOps / SRE / Platform / Cloud).
- Do NOT pretend a specific role exists. Frame it as proactive interest in the team/company.
- Still note the résumé is attached "in case it's useful."`
    : `MODE: JD-SPECIFIC (a real opening exists).
- The candidate is applying for the specific role named below.
- Reference the role and one concrete reason the candidate fits it.
- Note the tailored résumé is attached for that role.`;

  const personLine = personName
    ? `Recipient: ${personName}${personTitle ? ` — ${personTitle}` : ''}`
    : `Recipient: (unknown name — write to the relevant hiring decision-maker; do not invent a name)`;

  const signature = candidateSignature();
  const availability = candidateContact().availability;
  const availabilityRule = availability
    ? `\nAVAILABILITY (true — weave it in): the candidate is an IMMEDIATE JOINER (${availability}).
- Include this. In the subject use it when Strategy 1 fits (e.g. "... | Immediate Joiner").
- In the body, add one short natural phrase that you can join immediately (e.g. near the CTA).
- Indian recruiters always ask notice period, so stating immediate availability up front helps.`
    : '';

  const system = `You write ONE cold outreach email for a job seeker reaching a hiring
decision-maker (recruiter / hiring manager / engineering leader / founder) directly.

SUBJECT LINE — pick the strategy that fits the RECIPIENT, then write ONE subject:
Keep it short and skimmable. Use normal Title Case as in the examples (NOT all-lowercase, NOT
ALL-CAPS). Never use spam words ("urgent", "apply now", "free"). NEVER output a literal
placeholder — replace [X] with the candidate's real years of experience from the context, and
[Company Name] with the actual company. Only claim "Immediate Joiner / Available immediately"
if the candidate context supports it; otherwise drop it.

STRATEGY 1 — Immediate Value & Tech Stack (use for RECRUITERS / talent acquisition / agency):
put the exact tools they're hiring for right in the subject. Examples:
  • "DevOps Engineer | AWS, Kubernetes, Terraform | Immediate Joiner"
  • "Platform Engineer: [X] Years Exp (Expertise in AWS & GitOps)"
  • "SRE / Infrastructure Specialist | Available to join immediately"
  • "DevOps Engineer with [X] years hands-on K8s & CI/CD experience"

STRATEGY 2 — Infrastructure Pain Point (use for ENGINEERING MANAGERS / tech leads):
frame around reliability, scalability, cost, MTTR — a solution, not buzzwords. Examples:
  • "Automating infrastructure to cut down [Company Name]'s deployment times"
  • "Looking to scale [Company Name]'s Kubernetes clusters?"
  • "DevOps Engineer: Focused on reducing MTTR and cloud spend"
  • "Question about [Company Name]'s current infrastructure scalability"

STRATEGY 3 — Short, Casual & High-Open (use for STARTUPS / founders / scale-ups):
short, curiosity-driven, not template-like. Examples:
  • "DevOps / SRE introduction"
  • "Infrastructure engineering at [Company Name]"
  • "Quick question re: [Company Name]'s cloud setup"
  • "Terraform + K8s specialist looking at [Company Name]"

If you can't tell the recipient type, default to Strategy 1. Do NOT use the weak phrasing
"applying for your {role} role".

WHAT TO SAY — value-first (answer "what can I bring to THIS company?"):
- Read the JD/post and identify the skills & tools it REQUIRES for this role.
- From the candidate context below, name the required skills the candidate ALREADY HAS —
  that overlap is the pitch. Put **markdown bold** around the 2–4 most important matched
  skills/tools (e.g. **AWS**, **Kubernetes**, **Terraform**) and the single core value phrase.
- Frame the email around HOW those skills help THIS company (the value you bring) — not just
  a list of past tasks. Connect your skill → their need.
- Back it with ONE concrete proof metric from the candidate context. Use ONLY real numbers
  that appear in the context — NEVER invent or round up.
- NEVER claim a skill that is not in the candidate context, even if the JD demands it.
- Company research: if you genuinely recognize the company, you MAY reference ONE accurate,
  widely-known fact about what they do, to show you did your homework. If you are not sure,
  rely only on the JD/post — do NOT fabricate company facts.

STRUCTURE (in this order):
1. Greeting: when a recipient name is given, ALWAYS use it — "Hi {first name},". Only use
   "Hello," when no name is provided. Never invent a name.
2. One line: state your name and that you're applying for the exact {role} at {company}.
   Keep it clean — do NOT add filler self-descriptors or guess your location/title.
3. Value: 1–2 sentences on how your **matched skills** help this company.
4. Proof: one real metric that supports the value.
5. CTA: exactly ONE (e.g. "would you be open to a quick 15-minute call?" /
   "is this the right address to send my CV for the {role} role?").
6. A closing line ONLY — "Best regards," — then STOP. Do NOT write the name, phone, or links;
   an accurate signature is appended automatically.

FORMATTING & LENGTH:
- Tight and skimmable — about 5–7 short sentences of prose.
- Use **markdown bold** for emphasis, but SPARINGLY — only the 2–4 most important matched
  skills/tools and the one core value phrase. Do NOT bold whole sentences. Use no other markdown
  (no bullets, no headings, no italics).
- Mention the résumé is ATTACHED — do not paste it into the body.
- Plain, warm, professional. Write to a real human. Tailor tone to seniority if a title is given.
${availabilityRule}
${modeRules}
${templateBlock}
${CLI_RULES}

OUTPUT FORMAT — return EXACTLY this, nothing else (end the body at the closing line — NO signature):
SUBJECT: <one-line lowercase english subject>
---
<email body ending with "Best regards,">

${candidateContext()}

═══════════════════════════════════════════════════════
EXTRA METRICS / FACTS (use only what's here; never invent)
═══════════════════════════════════════════════════════
${masterBrief}`;

  const prompt = `Write the cold email.

Company: ${company || '(from JD)'}
Role: ${role || '(infer from JD / candidate target roles)'}
${personLine}
Mode: ${m}

${jd ? `JOB DESCRIPTION / CONTEXT:\n${String(jd).trim()}` : '(No JD text provided — rely on role + company + candidate context.)'}`;

  // `signature` is the canonical, accurate contact block. Callers append it to the
  // parsed body (parseColdEmail does this when given the signature) so the phone and
  // LinkedIn URL are always correct rather than re-typed by the model.
  return { system, prompt, signature };
}

/**
 * Parse the model's "SUBJECT: ...\n---\nbody" output into { subject, body }.
 * Pass `signature` to append the accurate contact block. The body keeps its
 * **markdown bold** markers — the UI renders them as real bold and the "Copy"
 * button copies rich text, so emphasis survives into Gmail.
 */
export function parseColdEmail(text, signature = '') {
  const raw = String(text || '').trim();
  const sm = raw.match(/^SUBJECT:\s*(.+?)\s*(?:\n|$)/i);
  const subject = (sm ? sm[1].trim() : '').replace(/\*\*/g, ''); // never bold the subject
  const sep = raw.indexOf('---');
  let body = sep >= 0 ? raw.slice(sep + 3).trim() : raw.replace(/^SUBJECT:.*\n?/i, '').trim();
  if (signature) {
    // Drop any name/contact the model appended after the closing line, then add ours.
    body = body.replace(/\n+(best regards,?|regards,?|thanks,?|sincerely,?)\s*[\s\S]*$/i, (m, kw) => `\n\n${kw}`);
    body = `${body}\n${signature}`;
  }
  return { subject, body };
}
