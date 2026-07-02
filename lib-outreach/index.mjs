/**
 * lib-outreach — cold-outreach email discovery + verification engine.
 *
 * Public surface for the web API routes, the CLI (outreach.mjs), and any future
 * MCP tool. See email-finder-roadmap/OUTREACH_PLAN.md for the full design and
 * SENDER_SAFETY.md for why verification is mandatory before any draft.
 */

export { discover } from './discover.mjs';
export { discoverCompany } from './discover-company.mjs';
export { verifyEmail, mxLookup, syntaxValid, isRoleBased, hunterVerify, bouncerVerify, zerobounceVerify } from './verify.mjs';
export { hunterDomain, hunterFind, prospeoFind, snovFind, snovAuth } from './finders.mjs';
export { parseName, permutations, applyPattern } from './permute.mjs';
export { KEYS, keyStatus, ROOT } from './keys.mjs';
export {
  listOutreach, getOutreach, findByEmail, addOutreach, updateOutreach,
  deleteOutreach, dueForFollowUp, OUTREACH_STATUSES,
} from './store.mjs';
export {
  TEMPLATES, TEMPLATE_IDS, getTemplate, nextTemplate, templateStats,
} from './templates.mjs';
export { scanPosts, apifyTokens } from './scan-posts.mjs';
