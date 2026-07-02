/**
 * lib-ai — career-ops shared AI engine (multi-provider, task-routed).
 *
 * One engine, consumed by every surface: CLI scripts, the MCP server, and the
 * web dashboard. Provider/model selection lives in config/ai.yml; this module
 * only exposes the machinery to run a task.
 *
 *   import { runTask, buildEvaluateJob } from './lib-ai/index.mjs';
 *   const { system, prompt } = buildEvaluateJob(jdText);
 *   const { text } = await runTask('evaluate_job', { system, prompt });
 */

export { runTask } from './run.mjs';
export { streamTask } from './stream.mjs';
export { loadAiConfig, resolveChain, allSpecs, ROOT } from './config.mjs';
export { resolveModel, parseSpec } from './registry.mjs';
export {
  builders, hasBuilder, buildTask,
  buildEvaluateJob, buildTailorCv, buildCoverLetter, buildDraftReferral, buildInterviewPrep,
} from './tasks/index.mjs';
