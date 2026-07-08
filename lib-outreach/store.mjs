/**
 * lib-outreach/store.mjs — the cold-outreach tracking store (data/outreach.json).
 *
 * One record per (decision-maker email) outreach. Kept separate from referrals.json
 * because the cold-email lifecycle is distinct: drafted → sent → replied/bounced/
 * no_response → closed, with the found email, verification verdict, Gmail draft id,
 * and follow-up date. Dedup is by email so we never double-contact someone.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ROOT } from './keys.mjs';

const STORE = join(ROOT, 'data', 'outreach.json');

function userStore(userId) {
  return userId ? join(ROOT, 'data', 'outreach', `${userId}.json`) : STORE;
}

export const OUTREACH_STATUSES = ['drafted', 'sent', 'replied', 'bounced', 'no_response', 'closed'];
const FOLLOWUP_DAYS = 6; // one nudge ~6 days after sending (SENDER_SAFETY §4: one follow-up max)

function load(storePath) {
  try {
    const j = JSON.parse(readFileSync(storePath, 'utf8'));
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function save(storePath, list) {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(list, null, 2) + '\n');
}

const slug = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
const todayISO = () => new Date().toISOString().slice(0, 10);

export function listOutreach(userId = '') {
  return load(userStore(userId));
}

export function getOutreach(id, userId = '') {
  return load(userStore(userId)).find((r) => r.id === id) || null;
}

/** Existing record for this email, if any (dedup / "already contacted" guard). */
export function findByEmail(email, userId = '') {
  if (!email) return null;
  const e = email.toLowerCase();
  return load(userStore(userId)).find((r) => r.email && r.email.toLowerCase() === e) || null;
}

/** Insert or (if the email already exists) merge-update. Returns the record. */
export function addOutreach(rec = {}, userId = '') {
  const storePath = userStore(userId);
  const list = load(storePath);
  const now = new Date().toISOString();

  const existing = rec.email ? list.find((r) => r.email && r.email.toLowerCase() === rec.email.toLowerCase()) : null;
  if (existing) {
    Object.assign(existing, rec, { id: existing.id, createdAt: existing.createdAt, updatedAt: now });
    save(storePath, list);
    return existing;
  }

  const id = rec.id || `out_${slug(rec.company)}_${slug(rec.email || rec.contactName || String(Date.now()))}`.slice(0, 60);
  const record = {
    id,
    userId: userId || rec.userId || '',
    company: rec.company || '',
    role: rec.role || '',
    domain: rec.domain || '',
    contactName: rec.contactName || '',
    contactTitle: rec.contactTitle || '',
    persona: rec.persona || '',
    email: rec.email || '',
    emailSource: rec.emailSource || '',
    verification: rec.verification || '',
    mode: rec.mode || 'jd_specific',
    templateId: rec.templateId || '',       // which A/B cold-mail template was used
    applyMethod: rec.applyMethod || '',      // email | form | dm | comment (from a hiring post)
    recruiterType: rec.recruiterType || '',  // inhouse | agency (from a hiring post)
    sourcePostUrl: rec.sourcePostUrl || '',  // the LinkedIn hiring post this came from
    subject: rec.subject || '',
    draftId: rec.draftId || '',
    status: OUTREACH_STATUSES.includes(rec.status) ? rec.status : 'drafted',
    resumeFile: rec.resumeFile || '',
    jobUrl: rec.jobUrl || '',
    note: rec.note || '',
    sentDate: rec.sentDate || '',
    followUpDate: rec.followUpDate || '',
    createdAt: now,
    updatedAt: now,
  };
  list.push(record);
  save(storePath, list);
  return record;
}

/** Patch a record by id. Marking it `sent` auto-sets sentDate + followUpDate. */
export function updateOutreach(id, patch = {}, userId = '') {
  const storePath = userStore(userId);
  const list = load(storePath);
  const r = list.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, patch, { updatedAt: new Date().toISOString() });
  if (patch.status === 'sent') {
    if (!r.sentDate) r.sentDate = todayISO();
    if (!r.followUpDate) {
      const d = new Date();
      d.setDate(d.getDate() + FOLLOWUP_DAYS);
      r.followUpDate = d.toISOString().slice(0, 10);
    }
  }
  save(storePath, list);
  return r;
}

/** Delete a record by id. Returns true if a record was removed. */
export function deleteOutreach(id, userId = '') {
  const storePath = userStore(userId);
  const list = load(storePath);
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  save(storePath, list);
  return true;
}

/** Records due for a follow-up nudge (sent, no reply, follow-up date reached). */
export function dueForFollowUp(onDate = todayISO(), userId = '') {
  return load(userStore(userId)).filter((r) => r.status === 'sent' && r.followUpDate && r.followUpDate <= onDate);
}
