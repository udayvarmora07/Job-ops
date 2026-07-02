/**
 * lib-ai/run.mjs — the ONE entry point every surface calls.
 *
 * CLI scripts, the MCP server, and the web app all call runTask(). It reads the
 * task's fallback chain from config/ai.yml, resolves the model, and runs it —
 * walking down the chain on a missing key / rate-limit / error.
 *
 *   const { text }   = await runTask('cover_letter', { system, prompt });
 *   const { object } = await runTask('evaluate_job', { system, prompt, schema });
 */

import { generateText, generateObject } from 'ai';
import { loadAiConfig, resolveChain } from './config.mjs';
import { resolveModel, providerKeyCount, parseSpec } from './registry.mjs';

// Round-robin start offset so successive calls spread across a provider's keys
// (proactively avoids hammering one key toward its RPM limit).
let rrCounter = 0;

/** Is this error a rate-limit / quota (429) — i.e. worth retrying on another key? */
export function isRateLimit(err) {
  const status = err?.statusCode ?? err?.status ?? err?.response?.status ?? err?.data?.error?.code;
  if (status === 429) return true;
  const msg = (err?.message || String(err)).toLowerCase();
  return /\b429\b|rate.?limit|too many requests|quota|over capacity|overloaded/.test(msg);
}

/**
 * @param {string} taskName              key under `tasks:` in config/ai.yml
 * @param {object} opts
 * @param {string} [opts.system]         system prompt
 * @param {string} [opts.prompt]         user prompt (use this OR messages)
 * @param {Array}  [opts.messages]       chat messages (overrides prompt)
 * @param {object} [opts.schema]         Zod schema → uses generateObject
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxOutputTokens]
 * @param {string} [opts.modelOverride]  force a single "provider:model" spec
 * @param {boolean}[opts.dryRun]         return the assembled request, spend nothing
 * @returns {Promise<{text?,object?,usage,model,provider,modelId,attempts}>}
 */
export async function runTask(taskName, opts = {}) {
  const {
    system, prompt, messages, schema,
    temperature, maxOutputTokens, modelOverride, dryRun,
  } = opts;

  const cfg = loadAiConfig();
  const chain = modelOverride ? [modelOverride] : resolveChain(cfg, taskName);
  const temp = temperature ?? cfg.defaults.temperature ?? 0.4;
  const maxOut = maxOutputTokens ?? cfg.defaults.maxOutputTokens ?? 8192;

  if (dryRun) {
    return { dryRun: true, task: taskName, chain, system, prompt, messages };
  }

  const attempts = [];
  for (const spec of chain) {
    let keyCount = 1;
    try {
      keyCount = providerKeyCount(spec, cfg.providers);
    } catch (err) {
      // Unknown provider — skip quietly, try the next model.
      attempts.push({ spec, ok: false, reason: err.message });
      continue;
    }

    // Try each key, starting at a rotating offset; on a 429 rotate to the next
    // key for the SAME model. Any other error falls through to the next model.
    let modelDone = false;
    for (let k = 0; k < Math.max(1, keyCount) && !modelDone; k++) {
      const keyIndex = rrCounter + k;
      let resolved;
      try {
        resolved = resolveModel(spec, cfg.providers, keyIndex);
      } catch (err) {
        // Missing key — no point trying other indices for this provider.
        attempts.push({ spec, ok: false, reason: err.message });
        modelDone = true;
        break;
      }

      try {
        const base = { model: resolved.model, system, temperature: temp, maxOutputTokens: maxOut };
        const call = messages ? { ...base, messages } : { ...base, prompt };

        let out;
        if (schema) {
          const { object, usage } = await generateObject({ ...call, schema });
          out = { object, usage };
        } else {
          const { text, usage } = await generateText(call);
          out = { text, usage };
        }
        rrCounter++; // advance round-robin so the next call starts on a fresh key
        return {
          ...out, model: spec, provider: resolved.provider, modelId: resolved.modelId,
          keyIndex: resolved.keyIndex, attempts,
        };
      } catch (err) {
        attempts.push({ spec, keyIndex: resolved.keyIndex, ok: false, reason: err.message || String(err) });
        if (isRateLimit(err) && k < keyCount - 1) {
          continue; // rate-limited → try the next key for this same model
        }
        modelDone = true; // non-429, or keys exhausted → next model in the chain
      }
    }
  }

  const detail = attempts.map((a) => `  - ${a.spec}: ${a.reason}`).join('\n');
  const err = new Error(
    `All models failed for task "${taskName}":\n${detail || '  (no models in chain)'}`
  );
  err.attempts = attempts;
  throw err;
}
