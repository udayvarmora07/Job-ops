/**
 * lib-ai/stream.mjs — streaming counterpart to runTask, for the web dashboard.
 *
 * Returns the AI SDK streamText result so a Next.js route can pipe tokens to the
 * browser live. Same config/ai.yml routing; picks the first model that actually
 * responds — probing each with a 1-token call (cached 5 min) before committing
 * to the full streaming request, so a bad provider never silently kills output.
 */

import { streamText, generateText } from 'ai';
import { loadAiConfig, resolveChain } from './config.mjs';
import { resolveModel, providerKeyCount } from './registry.mjs';

// In-process probe cache: "spec#keyIndex" → { ok, checkedAt }
// Survives for the lifetime of the Next.js worker (cleared on restart).
const probeCache = new Map();
const PROBE_TTL = 5 * 60 * 1000; // 5 minutes

// Round-robin start offset so successive streams spread across a provider's keys.
let rrCounter = 0;

async function isReachable(resolved, cacheKey) {
  const hit = probeCache.get(cacheKey);
  if (hit && Date.now() - hit.checkedAt < PROBE_TTL) return hit.ok;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // 8 s probe timeout
  try {
    await generateText({
      model: resolved.model,
      prompt: '.',
      maxOutputTokens: 1,
      temperature: 0,
      abortSignal: ctrl.signal,
    });
    probeCache.set(cacheKey, { ok: true, checkedAt: Date.now() });
    return true;
  } catch {
    probeCache.set(cacheKey, { ok: false, checkedAt: Date.now() });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{ result: import('ai').StreamTextResult, model: string }>}
 */
export async function streamTask(taskName, opts = {}) {
  const { system, prompt, messages, temperature, maxOutputTokens, modelOverride } = opts;

  const cfg = loadAiConfig();
  const chain = modelOverride ? [modelOverride] : resolveChain(cfg, taskName);
  const temp = temperature ?? cfg.defaults.temperature ?? 0.4;
  const maxOut = maxOutputTokens ?? cfg.defaults.maxOutputTokens ?? 8192;

  const errors = [];
  for (const spec of chain) {
    let keyCount = 1;
    try {
      keyCount = providerKeyCount(spec, cfg.providers);
    } catch (err) {
      errors.push(`${spec}: ${err.message}`);
      continue;
    }

    // Try each key (rotating start). A failed probe — including a rate-limited
    // key — falls through to the next key, then the next model.
    let modelDone = false;
    for (let k = 0; k < Math.max(1, keyCount) && !modelDone; k++) {
      let resolved;
      try {
        resolved = resolveModel(spec, cfg.providers, rrCounter + k);
      } catch (err) {
        errors.push(`${spec}: ${err.message}`);
        modelDone = true;
        break;
      }

      // Probe before committing — errors surface during stream consumption otherwise.
      const ok = await isReachable(resolved, `${spec}#${resolved.keyIndex}`);
      if (!ok) {
        errors.push(`${spec} (key ${resolved.keyIndex}): unreachable (probe failed)`);
        continue;
      }

      const base = { model: resolved.model, system, temperature: temp, maxOutputTokens: maxOut };
      const call = messages ? { ...base, messages } : { ...base, prompt };
      const result = streamText(call);
      rrCounter++; // advance round-robin so the next stream starts on a fresh key
      return { result, model: spec };
    }
  }

  throw new Error(
    `No usable model for task "${taskName}":\n  ${errors.join('\n  ') || '(empty chain)'}`
  );
}
