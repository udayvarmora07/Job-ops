/**
 * lib-ai/registry.mjs — turns a "provider:model" spec into an AI SDK model.
 *
 * Every provider in config/ai.yml is treated as an OpenAI-compatible endpoint
 * (NVIDIA NIM, OpenRouter, DeepSeek, Moonshot, Zhipu, MiniMax all expose one).
 * Adding a new provider is therefore pure config — no code change here.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// One provider client per (provider name + key index), reused across calls.
const providerCache = new Map();

/** Split "nim:deepseek-ai/deepseek-v4-pro" → { provider: "nim", model: "deepseek-ai/deepseek-v4-pro" }. */
export function parseSpec(spec) {
  const idx = String(spec).indexOf(':');
  if (idx === -1) {
    throw new Error(`Invalid model spec "${spec}" — expected "provider:model-id".`);
  }
  return { provider: spec.slice(0, idx), model: spec.slice(idx + 1) };
}

/**
 * All API keys configured for a provider, for failover / load-spreading.
 * Reads the base env var (e.g. NVIDIA_NIM_API_KEY) plus numbered siblings
 * (NVIDIA_NIM_API_KEY_2, _3, ...). De-duplicated, in order.
 */
export function providerKeys(def) {
  const base = def.apiKeyEnv;
  const names = [base, ...Array.from({ length: 9 }, (_, i) => `${base}_${i + 2}`)];
  const seen = new Set();
  const out = [];
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

/** How many keys a provider has (≥1, or throws UNKNOWN_PROVIDER / MISSING_KEY). */
export function providerKeyCount(spec, providers) {
  const { provider: name } = parseSpec(spec);
  const def = providers[name];
  if (!def) {
    const err = new Error(`Unknown provider "${name}" in spec "${spec}".`);
    err.code = 'UNKNOWN_PROVIDER';
    throw err;
  }
  return providerKeys(def).length;
}

/**
 * Resolve a spec to a live AI SDK model handle, using the key at `keyIndex`
 * (rotated within the provider's key pool — see run.mjs / stream.mjs).
 * @throws {Error & {code}} MISSING_KEY when no API key is set for the provider,
 *         UNKNOWN_PROVIDER when the prefix isn't defined in config.
 */
export function resolveModel(spec, providers, keyIndex = 0) {
  const { provider: name, model: modelId } = parseSpec(spec);

  const def = providers[name];
  if (!def) {
    const err = new Error(
      `Unknown provider "${name}" in spec "${spec}". Define it under "providers:" in config/ai.yml.`
    );
    err.code = 'UNKNOWN_PROVIDER';
    throw err;
  }

  const keys = providerKeys(def);
  if (!keys.length) {
    const err = new Error(`Missing API key — set ${def.apiKeyEnv} in .env (provider "${name}").`);
    err.code = 'MISSING_KEY';
    err.apiKeyEnv = def.apiKeyEnv;
    throw err;
  }

  const idx = ((keyIndex % keys.length) + keys.length) % keys.length;
  const apiKey = keys[idx];
  const cacheKey = `${name}#${idx}`;
  let client = providerCache.get(cacheKey);
  if (!client) {
    // `def.headers` lets a provider ship extra static headers (e.g. AgentRouter
    // needs a CLI wire-image User-Agent or its WAF rejects the request).
    // The AI SDK's `headers` option can't override reserved headers like
    // User-Agent (it stamps its own `ai/x.y` UA last), so we force them through
    // a fetch wrapper that applies def.headers AFTER the SDK builds the request.
    const opts = { name, baseURL: def.baseURL, apiKey };
    if (def.headers) {
      opts.headers = def.headers;
      opts.fetch = async (url, init = {}) => {
        const h = new Headers(init.headers || {});
        for (const [k, v] of Object.entries(def.headers)) h.set(k, v);
        if (!h.has('authorization')) h.set('Authorization', `Bearer ${apiKey}`);
        return fetch(url, { ...init, headers: h });
      };
    }
    client = createOpenAICompatible(opts);
    providerCache.set(cacheKey, client);
  }

  return {
    model: client(modelId),
    provider: name,
    modelId,
    baseURL: def.baseURL,
    apiKeyEnv: def.apiKeyEnv,
    keyIndex: idx,
    keyCount: keys.length,
  };
}
