#!/usr/bin/env node
/**
 * ai.mjs — jobops multi-provider AI CLI.
 *
 * One entry point for every AI task, routed through config/ai.yml. Models live
 * on NVIDIA NIM (DeepSeek V4 Pro, Kimi K2.6, GLM 5.1, MiniMax M3) behind a
 * single NVIDIA_NIM_API_KEY — switchable per task by editing config/ai.yml.
 *
 * USAGE
 *   node ai.mjs verify                      Check every configured slug resolves
 *   node ai.mjs eval "<JD text>"            Evaluate a job (A–G report)
 *   node ai.mjs eval --file ./jds/x.txt
 *   node ai.mjs run <task> --file <path>    Run any task with file/STDIN input
 *
 * OPTIONS
 *   --file <path>     Read input from a file
 *   --model <spec>    Force one model (e.g. nim:zai/glm-5.1), bypass the chain
 *   --dry-run         Print the assembled prompt without calling any model
 *   --help            Show this help
 */

import { readFileSync, existsSync } from 'fs';
import { loadAiConfig, allSpecs } from './lib-ai/config.mjs';
import { parseSpec } from './lib-ai/registry.mjs';
import { runTask } from './lib-ai/run.mjs';
import { buildEvaluateJob } from './lib-ai/tasks/evaluate-job.mjs';
import { buildTask, hasBuilder } from './lib-ai/tasks/index.mjs';

const argv = process.argv.slice(2);

function getFlag(name) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
}
function hasFlag(name) {
  return argv.includes(name);
}
/** Positional args (everything that isn't a flag or a flag value). */
function positionals() {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '--model') { i++; continue; }
    if (a.startsWith('--')) continue;
    out.push(a);
  }
  return out;
}

function readInput() {
  const file = getFlag('--file');
  if (file) {
    if (!existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1); }
    return readFileSync(file, 'utf-8').trim();
  }
  // Inline positional text (everything after the subcommand).
  return positionals().slice(1).join(' ').trim();
}

// ── verify ──────────────────────────────────────────────────────────────────
// Hit each provider's OpenAI-compatible /models endpoint and confirm every slug
// referenced in config/ai.yml actually exists in the live catalog.
async function cmdVerify() {
  const cfg = loadAiConfig();
  const specs = allSpecs(cfg);
  if (!specs.length) { console.log('No model specs configured in config/ai.yml.'); return; }

  // Group requested model ids by provider.
  const byProvider = new Map();
  for (const spec of specs) {
    const { provider, model } = parseSpec(spec);
    if (!byProvider.has(provider)) byProvider.set(provider, new Set());
    byProvider.get(provider).add(model);
  }

  let anyFail = false;
  for (const [provider, models] of byProvider) {
    const def = cfg.providers[provider];
    console.log(`\n▸ provider "${provider}"`);
    if (!def) { console.log('  ✗ not defined under providers: in config/ai.yml'); anyFail = true; continue; }
    const apiKey = process.env[def.apiKeyEnv];
    if (!apiKey) { console.log(`  ⚠ ${def.apiKeyEnv} not set — set it in .env to verify slugs`); anyFail = true; continue; }

    let available = null;
    try {
      const res = await fetch(`${def.baseURL.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, ...(def.headers || {}) },
      });
      if (!res.ok) { console.log(`  ✗ /models returned HTTP ${res.status}`); anyFail = true; continue; }
      const body = await res.json();
      available = new Set((body.data || []).map((m) => m.id));
      console.log(`  catalog: ${available.size} models reachable`);
    } catch (err) {
      console.log(`  ✗ could not reach ${def.baseURL}: ${err.message}`);
      anyFail = true;
      continue;
    }

    for (const model of [...models].sort()) {
      if (available.has(model)) {
        console.log(`  ✓ ${model}`);
      } else {
        console.log(`  ✗ ${model}  — not in catalog (check the slug)`);
        anyFail = true;
      }
    }
  }

  console.log('');
  process.exit(anyFail ? 1 : 0);
}

// ── eval ────────────────────────────────────────────────────────────────────
async function cmdEval() {
  const jd = readInput();
  if (!jd) { console.error('No job description. Pass text or --file <path>.'); process.exit(1); }

  const { system, prompt } = buildEvaluateJob(jd);
  const modelOverride = getFlag('--model');
  const dryRun = hasFlag('--dry-run');

  if (dryRun) {
    console.log('--- SYSTEM ---\n' + system + '\n\n--- PROMPT ---\n' + prompt);
    return;
  }

  console.error('Evaluating… (model chain from config/ai.yml)');
  const r = await runTask('evaluate_job', { system, prompt, modelOverride });
  console.error(`\n[model: ${r.model}]\n`);
  console.log(r.text);
}

// ── run <task> ────────────────────────────────────────────────────────────────
async function cmdRun() {
  const task = positionals()[1];
  if (!task) { console.error('Usage: node ai.mjs run <task> --file <path>'); process.exit(1); }
  const input = readInput();
  if (!input) { console.error('No input. Pass text or --file <path>.'); process.exit(1); }

  const modelOverride = getFlag('--model');
  // If the task has a context-builder, assemble system+prompt; else send raw.
  const built = hasBuilder(task) ? buildTask(task, input) : null;
  const opts = built
    ? { system: built.system, prompt: built.prompt, modelOverride, dryRun: hasFlag('--dry-run') }
    : { prompt: input, modelOverride, dryRun: hasFlag('--dry-run') };

  const r = await runTask(task, opts);
  if (r.dryRun) { console.log(JSON.stringify(r, null, 2)); return; }
  console.error(`\n[model: ${r.model}]\n`);
  console.log(r.text);
}

// ── dispatch ──────────────────────────────────────────────────────────────────
const cmd = positionals()[0];

if (!cmd || hasFlag('--help') || hasFlag('-h')) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('\n')
    .filter((l) => l.startsWith(' *') || l.startsWith('/**'))
    .map((l) => l.replace(/^\s?\*\/?|^\/\*\*/, '').trimEnd()).join('\n'));
  process.exit(0);
}

try {
  if (cmd === 'verify') await cmdVerify();
  else if (cmd === 'eval') await cmdEval();
  else if (cmd === 'run') await cmdRun();
  else { console.error(`Unknown command "${cmd}". Try: verify | eval | run`); process.exit(1); }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}
