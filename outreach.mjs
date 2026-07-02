#!/usr/bin/env node
/**
 * outreach.mjs — CLI for the cold-outreach email engine (lib-outreach/).
 *
 *   node outreach.mjs find --name "Jane Doe" --company "Acme" [--domain acme.com] [--deep]
 *   node outreach.mjs verify --email jane@acme.com [--deep]
 *   node outreach.mjs pattern --domain acme.com
 *   node outreach.mjs credits          # remaining free credits per provider
 *   node outreach.mjs keys             # how many keys are configured per provider
 *
 * Discovery NEVER sends anything — it finds + verifies emails. Drafting/sending
 * (Gmail) is a later, separate, review-gated step. See OUTREACH_PLAN.md.
 */

import { readFileSync } from 'fs';
import {
  discover, verifyEmail, hunterDomain, keyStatus, KEYS,
  listOutreach, addOutreach, updateOutreach, dueForFollowUp, OUTREACH_STATUSES,
} from './lib-outreach/index.mjs';
import { runTask } from './lib-ai/run.mjs';
import { buildColdEmail, parseColdEmail } from './lib-ai/tasks/cold-email.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const STATUS_ICON = {
  valid: '✅', invalid: '❌', 'catch-all': '🟡', risky: '🟠',
  disposable: '🗑️', unknown: '❔',
};

function printCandidate(c) {
  const v = c.verification;
  const flags = [
    STATUS_ICON[v.status] || '❔', v.status,
    v.roleBased ? 'role-based' : null,
    v.catchAll ? 'catch-all-domain' : null,
  ].filter(Boolean).join(' ');
  const provs = v.providers.map((p) => `${p.provider}:${p.status}`).join(', ') || 'mx-only';
  console.log(`  ${c.recommended ? '➜' : ' '} ${c.email.padEnd(34)} ${String(c.confidence).padStart(3)}%  ${flags}`);
  console.log(`      sources: ${c.sources.join(', ')}   verify: ${provs}`);
}

async function cmdFind(a) {
  const name = a.name || a.n;
  if (!name) return fail('--name "First Last" is required');
  if (!a.company && !a.domain) return fail('provide --company and/or --domain');
  console.log(`\n🔎 Discovering email for: ${name}  @  ${a.domain || a.company}\n`);
  const r = await discover({
    name, company: a.company, domain: a.domain, deep: !!a.deep,
    maxVerify: a.max ? Number(a.max) : 6,
  });
  console.log(`Domain:   ${r.domain || '(unresolved)'}${r.organization ? `  (${r.organization})` : ''}`);
  console.log(`Pattern:  ${r.pattern || '(unknown)'}${r.acceptAll ? '   ⚠️  catch-all domain — "valid" can\'t be guaranteed' : ''}`);
  console.log(`Steps:    ${r.steps.join(' → ') || '(none)'}\n`);
  if (!r.candidates.length) return console.log('No candidate emails found.\n');
  console.log(`Candidates (ranked):`);
  r.candidates.forEach(printCandidate);
  console.log('');
  if (r.best && r.best.recommended) {
    console.log(`✅ BEST (safe to draft): ${r.best.email}  (${r.best.confidence}%)\n`);
  } else {
    console.log(`⚠️  No address verified "valid" — do NOT cold-email a guessed address.`);
    console.log(`   Use the manual Gmail people-chip check, or try --deep for a ZeroBounce pass.\n`);
  }
}

async function cmdVerify(a) {
  if (!a.email) return fail('--email is required');
  const v = await verifyEmail(a.email, { deep: !!a.deep });
  console.log(JSON.stringify(v, null, 2));
}

async function cmdPattern(a) {
  if (!a.domain && !a.company) return fail('--domain or --company is required');
  const ds = await hunterDomain(a.domain, a.domain ? null : a.company);
  if (!ds) return console.log('No data (Hunter domain-search returned nothing).');
  console.log(`Domain:    ${ds.domain}`);
  console.log(`Org:       ${ds.organization || '-'}`);
  console.log(`Pattern:   ${ds.pattern || '(unknown)'}`);
  console.log(`Catch-all: ${ds.acceptAll ? 'YES ⚠️' : 'no'}`);
  console.log(`Indexed emails (${ds.emails.length}):`);
  ds.emails.slice(0, 10).forEach((e) =>
    console.log(`  ${(e.email || '').padEnd(34)} ${String(e.confidence ?? '').padStart(3)}%  ${[e.firstName, e.lastName].filter(Boolean).join(' ')}  ${e.position || ''}`));
}

async function getJson(url, opts) {
  try { const r = await fetch(url, opts); return await r.json(); } catch { return null; }
}

async function cmdCredits() {
  console.log('\nRemaining free credits (live):\n');
  // Hunter
  for (const k of KEYS.hunter()) {
    const j = await getJson(`https://api.hunter.io/v2/account?api_key=${k}`);
    const rq = j?.data?.requests;
    if (rq) console.log(`  Hunter      searches ${rq.searches.available - rq.searches.used}/${rq.searches.available}, verifications ${rq.verifications.available - rq.verifications.used}/${rq.verifications.available}`);
    else console.log('  Hunter      (could not read account)');
  }
  // Prospeo (per key)
  let pi = 1;
  for (const k of KEYS.prospeo()) {
    const j = await getJson('https://api.prospeo.io/account-information', { method: 'POST', headers: { 'X-KEY': k } });
    const rem = j?.response?.remaining_credits;
    console.log(`  Prospeo #${pi++}  ${rem ?? '?'} credits remaining`);
  }
  // Snov
  if (KEYS.snov()) {
    const { snovAuth } = await import('./lib-outreach/finders.mjs');
    const t = await snovAuth();
    const j = t ? await getJson(`https://api.snov.io/v1/get-balance?access_token=${t}`) : null;
    console.log(`  Snov        ${j?.data?.balance ?? '?'} balance`);
  }
  // Bouncer (per key)
  let bi = 1;
  for (const k of KEYS.bouncer()) {
    const j = await getJson('https://api.usebouncer.com/v1.1/credits', { headers: { 'x-api-key': k } });
    console.log(`  Bouncer #${bi++}  ${j?.credits ?? '?'} credits`);
  }
  // ZeroBounce
  for (const k of KEYS.zerobounce()) {
    const j = await getJson(`https://api.zerobounce.net/v2/getcredits?api_key=${k}`);
    console.log(`  ZeroBounce  ${j?.Credits ?? '?'} credits  ${Number(j?.Credits) <= 10 ? '⚠️ low — used last, only when still inconclusive' : ''}`);
  }
  console.log('');
}

async function cmdCompose(a) {
  if (!a.company && !a.jd && !a['jd-file']) return fail('provide --company (and --role/--person) or --jd/--jd-file');
  const jd = a['jd-file'] ? readFileSync(a['jd-file'], 'utf8') : (a.jd && a.jd !== true ? a.jd : '');
  const mode = a.mode === 'speculative' ? 'speculative' : 'jd_specific';
  const { system, prompt, signature } = buildColdEmail({
    company: a.company || '', role: a.role || '',
    personName: a.person || '', personTitle: a.title || '',
    jd, mode,
  });
  const { text, model } = await runTask('cold_email', { system, prompt });
  const { subject, body } = parseColdEmail(text, signature);
  const to = a.to && a.to !== true ? a.to : '';

  if (a.json) {
    // Draft-ready output: pipe straight into a Gmail create_draft call.
    console.log(JSON.stringify({ to, subject, body, mode, model }, null, 2));
    return;
  }
  console.log(`\n[model: ${model}]   mode: ${mode}\n`);
  if (to) console.log(`To: ${to}`);
  console.log(`Subject: ${subject}\n`);
  console.log(body);
  console.log(`\n— draft only. Verify the recipient with \`outreach verify\` and attach the tailored résumé yourself before sending.\n`);
}

function cmdLog(a) {
  if (!a.company && !a.email) return fail('--company and/or --email required to log an outreach');
  const rec = addOutreach({
    company: a.company || '', role: a.role || '', domain: a.domain || '',
    contactName: a.name || '', contactTitle: a.title || '', persona: a.persona || '',
    email: a.email || '', emailSource: a.source || '', verification: a.verification || '',
    mode: a.mode === 'speculative' ? 'speculative' : 'jd_specific',
    subject: a.subject && a.subject !== true ? a.subject : '',
    draftId: a['draft-id'] && a['draft-id'] !== true ? a['draft-id'] : '',
    status: a.status || 'drafted', resumeFile: a.resume || '', jobUrl: a.url || '', note: a.note || '',
  });
  console.log(`Logged outreach ${rec.id}  [${rec.status}]  ${rec.email || '(no email)'} @ ${rec.company}`);
}

function cmdUpdate(a) {
  if (!a.id) return fail('--id required');
  const patch = {};
  for (const f of ['status', 'note', 'draftId', 'sentDate', 'followUpDate', 'email', 'verification']) {
    const key = f === 'draftId' ? 'draft-id' : f;
    if (a[key] !== undefined && a[key] !== true) patch[f] = a[key];
  }
  if (patch.status && !OUTREACH_STATUSES.includes(patch.status)) {
    return fail(`status must be one of: ${OUTREACH_STATUSES.join(', ')}`);
  }
  const r = updateOutreach(a.id, patch);
  if (!r) return fail(`no outreach record with id ${a.id}`);
  console.log(`Updated ${r.id} → status=${r.status}${r.followUpDate ? `, follow-up ${r.followUpDate}` : ''}`);
}

function rowOut(r) {
  console.log(`  ${r.status.padEnd(12)} ${(r.email || '-').padEnd(32)} ${(r.company || '').padEnd(18)} ${r.mode.padEnd(12)} ${r.followUpDate || ''}  ${r.id}`);
}

function cmdList(a) {
  let rows = listOutreach();
  if (a.status) rows = rows.filter((r) => r.status === a.status);
  if (!rows.length) return console.log('No outreach logged yet.');
  console.log(`\nOutreach (${rows.length}):  status        email                            company            mode          follow-up\n`);
  rows.forEach(rowOut);
  console.log('');
}

function cmdFollowups() {
  const due = dueForFollowUp();
  if (!due.length) return console.log('No follow-ups due.');
  console.log(`\n${due.length} follow-up(s) due (sent, no reply):\n`);
  due.forEach(rowOut);
  console.log('');
}

function cmdKeys() {
  const s = keyStatus();
  console.log('\nConfigured keys per provider:');
  console.log(`  Hunter:     ${s.hunter}`);
  console.log(`  Prospeo:    ${s.prospeo}`);
  console.log(`  Snov:       ${s.snov}`);
  console.log(`  Bouncer:    ${s.bouncer}`);
  console.log(`  ZeroBounce: ${s.zerobounce}\n`);
}

function fail(msg) { console.error(`Error: ${msg}`); process.exitCode = 1; }

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const map = {
  find: cmdFind, verify: cmdVerify, pattern: cmdPattern, compose: cmdCompose,
  log: cmdLog, list: cmdList, update: cmdUpdate, followups: cmdFollowups,
  credits: cmdCredits, keys: cmdKeys,
};
if (!map[cmd]) {
  console.log('Usage: node outreach.mjs <find|verify|pattern|compose|log|list|update|followups|credits|keys> [--flags]');
  process.exit(cmd ? 1 : 0);
}
await map[cmd](args);
