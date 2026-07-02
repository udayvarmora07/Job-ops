/**
 * lib-ai/tasks/index.mjs — registry of task prompt-builders.
 *
 * Maps a task name → a builder (input) => { system, prompt }. The CLI and the
 * MCP server look a task up here; if a builder exists it assembles the full
 * jobops context, otherwise the raw input is sent as a plain prompt.
 *
 * Model selection for every task lives in config/ai.yml — independent of this.
 */

import { buildEvaluateJob } from './evaluate-job.mjs';
import { buildTailorCv } from './tailor-cv.mjs';
import { buildTailorCvJson } from './tailor-cv-json.mjs';
import { buildCoverLetter } from './cover-letter.mjs';
import { buildDraftReferral } from './draft-referral.mjs';
import { buildInterviewPrep } from './interview-prep.mjs';
import { buildConnectionNotes } from './connection-notes.mjs';
import { buildColdEmail } from './cold-email.mjs';
import { buildParseHiringPost } from './parse-hiring-post.mjs';
import { buildResumeQa } from './resume-qa.mjs';

export const builders = {
  evaluate_job: buildEvaluateJob,
  tailor_cv: buildTailorCv,
  tailor_cv_json: buildTailorCvJson,
  cover_letter: buildCoverLetter,
  draft_referral: buildDraftReferral,
  interview_prep: buildInterviewPrep,
  connection_notes: buildConnectionNotes,
  cold_email: buildColdEmail,
  parse_hiring_post: buildParseHiringPost,
  resume_qa: buildResumeQa,
};

/** True if `task` has a context-assembling builder. */
export function hasBuilder(task) {
  return Object.prototype.hasOwnProperty.call(builders, task);
}

/** Build { system, prompt } for `task` from raw `input`, or null if no builder. */
export function buildTask(task, input) {
  return hasBuilder(task) ? builders[task](input) : null;
}

export {
  buildEvaluateJob, buildTailorCv, buildTailorCvJson, buildCoverLetter, buildDraftReferral, buildInterviewPrep,
  buildColdEmail, buildParseHiringPost, buildResumeQa,
};
