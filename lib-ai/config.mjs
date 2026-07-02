/**
 * lib-ai/config.mjs — loads .env + config/ai.yml and resolves task→model chains.
 *
 * This is the single place that reads the user's AI routing config. Everything
 * else (registry, run, tasks, the CLI, the MCP server, the web app) imports
 * from here so there is exactly one source of truth.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

/**
 * Find the jobops repo root robustly. Works from the CLI, the MCP server,
 * and inside a Next.js bundle (where import.meta.url / cwd may differ) by
 * walking up from several candidate bases until a marker file is found.
 */
function findRoot() {
  if (process.env.JOBOPS_ROOT && existsSync(process.env.JOBOPS_ROOT)) {
    return process.env.JOBOPS_ROOT;
  }
  const markers = ['modes/_shared.md', 'config/ai.yml', 'cv.md'];
  const bases = [];
  try { bases.push(dirname(fileURLToPath(import.meta.url))); } catch { /* bundled */ }
  bases.push(process.cwd());

  for (const base of bases) {
    let dir = base;
    for (let i = 0; i < 8; i++) {
      if (markers.some((m) => existsSync(join(dir, m)))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // Last resort: one level up from this file.
  try { return join(dirname(fileURLToPath(import.meta.url)), '..'); } catch { return process.cwd(); }
}

export const ROOT = findRoot();

// Load .env from the repo ROOT (not process.cwd()), so it works no matter where
// the process was started — CLI from root, MCP server, or Next dev from web/.
try {
  const { config } = await import('dotenv');
  config({ path: join(ROOT, '.env') });
} catch {
  // no dotenv — fall back to the ambient environment
}

const CONFIG_PATH = join(ROOT, 'config', 'ai.yml');

/** Read and lightly normalize config/ai.yml. Throws if the file is missing. */
export function loadAiConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `config/ai.yml not found at ${CONFIG_PATH}.\n` +
      `   This is the AI routing config (user layer). Restore it or re-run setup.`
    );
  }
  const cfg = yaml.load(readFileSync(CONFIG_PATH, 'utf-8')) || {};
  cfg.providers = cfg.providers || {};
  cfg.tasks = cfg.tasks || {};
  cfg.defaults = cfg.defaults || {};
  return cfg;
}

/**
 * Resolve the ordered fallback chain of model specs for a task.
 * Falls back to `default` when the task has no explicit mapping.
 */
export function resolveChain(cfg, taskName) {
  const entry = cfg.tasks[taskName];
  if (Array.isArray(entry) && entry.length) return entry;
  if (typeof entry === 'string' && entry) return [entry];
  if (cfg.default) return [cfg.default];
  throw new Error(
    `No model mapping for task "${taskName}" and no "default" set in config/ai.yml.`
  );
}

/** Every distinct model spec referenced anywhere in the config (for `verify`). */
export function allSpecs(cfg) {
  const specs = new Set();
  for (const entry of Object.values(cfg.tasks)) {
    (Array.isArray(entry) ? entry : [entry]).forEach((s) => s && specs.add(s));
  }
  if (cfg.default) specs.add(cfg.default);
  return [...specs];
}
