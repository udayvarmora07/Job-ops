// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const LOCAL_PARSER_TIMEOUT_MS = 20_000;
const LOCAL_PARSER_MAX_BUFFER_BYTES = 2_000_000;

// Project root — providers/ lives one level below it. Used to contain parser
// scripts inside the repo so a portals.yml entry can't point the spawner at an
// arbitrary host script (e.g. /etc/passwd).
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Interpreters a local parser is allowed to run. Anything else must itself be
// an in-repo script (see isInRepoScript). `rm`, `curl`, etc. are rejected.
const INTERPRETER_ALLOWLIST = new Set([
  'node', 'nodejs', 'python', 'python2', 'python3', 'ruby', 'perl', 'bash', 'sh', 'deno', 'bun', 'php',
]);

// Interpreter flags that execute inline code instead of a script file. These
// turn the spawn into arbitrary code execution and are never allowed.
const INLINE_CODE_FLAGS = [/^-e$/i, /^--eval(=|$)/i, /^-c$/i, /^--exec(=|$)/i, /^-p$/i, /^--print(=|$)/i];

/** True when `scriptPath` resolves to an existing file inside the project root. */
function isInRepoScript(scriptPath) {
  if (!scriptPath || typeof scriptPath !== 'string') return false;
  const abs = path.resolve(PROJECT_ROOT, scriptPath);
  const rel = path.relative(PROJECT_ROOT, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return existsSync(abs);
}

/**
 * Structural safety gate for a parser entry: a whitelisted interpreter running
 * an in-repo script (no inline-code flags, no options preceding the script), OR
 * a command that is itself an in-repo script. Returns false for anything else.
 */
function isParserSafe(entry) {
  const parser = entry.parser || {};
  const command = parser.command;
  if (!command || typeof command !== 'string') return false;

  const rawArgs = Array.isArray(parser.args) ? parser.args.map(String) : [];

  // No inline-code flags anywhere.
  if (rawArgs.some((a) => INLINE_CODE_FLAGS.some((re) => re.test(a)))) return false;

  if (INTERPRETER_ALLOWLIST.has(command.toLowerCase())) {
    // An interpreter must run an in-repo script and nothing may precede it.
    const scriptPath = getParserScriptPath(entry);
    if (!isInRepoScript(scriptPath)) return false;
    if (!parser.script) {
      // Script came from args — reject any interpreter option before it.
      const idx = rawArgs.findIndex((v) => !v.startsWith('-') && /\.(py|mjs|js|sh)$/.test(v));
      for (let i = 0; i < idx; i += 1) if (rawArgs[i].startsWith('-')) return false;
    }
    return true;
  }

  // Non-interpreter command: it must itself be an in-repo executable script.
  return isInRepoScript(command);
}

/**
 * Interpolation safety for fetch(): values expanded into argv from the entry
 * ({careers_url}, {company}) must not become injected flags. Throws a
 * descriptive error (mentioning the offending field) before any spawn.
 */
function assertSafeInterpolation(entry) {
  const parser = entry.parser || {};
  const args = Array.isArray(parser.args) ? parser.args.map(String) : [];
  const usesCareersUrl = args.some((a) => a.includes('{careers_url}')) ||
    (parser.script ? String(parser.script).includes('{careers_url}') : false);
  const usesCompany = args.some((a) => a.includes('{company}')) ||
    (parser.script ? String(parser.script).includes('{company}') : false);

  if (usesCareersUrl) {
    const url = entry.careers_url || '';
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`local-parser: careers_url must be an http(s) URL before interpolation (got "${url}")`);
    }
  }
  if (usesCompany) {
    const company = entry.name || '';
    if (company.startsWith('-')) {
      throw new Error(`local-parser: company name "${company}" cannot start with '-' (argument injection)`);
    }
  }
}

function expandParserArg(value, entry) {
  return String(value)
    .replaceAll('{careers_url}', entry.careers_url || '')
    .replaceAll('{company}', entry.name || '');
}

function getParserScriptPath(entry) {
  const parser = entry.parser || {};
  if (parser.script) return expandParserArg(parser.script, entry);

  const args = Array.isArray(parser.args) ? parser.args : [];
  const scriptArg = args.find(arg => {
    const value = String(arg);
    return !value.startsWith('-') && /\.(py|mjs|js|sh)$/.test(value);
  });

  return scriptArg ? expandParserArg(scriptArg, entry) : null;
}

function buildParserArgs(entry) {
  const parser = entry.parser || {};
  const args = [];

  if (parser.script) args.push(parser.script);
  if (Array.isArray(parser.args)) args.push(...parser.args);

  return args.map(arg => expandParserArg(arg, entry));
}

function normalizeJobUrl(rawUrl, baseUrl) {
  if (!rawUrl) return '';
  try {
    return new URL(String(rawUrl).trim(), baseUrl || undefined).href;
  } catch {
    return '';
  }
}

function normalizeLocation(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(normalizeLocation).filter(Boolean).join(', ');
  if (typeof value === 'object') return value.name || value.text || '';
  return String(value).trim();
}

function normalizeParserJob(job, entry) {
  if (!job || typeof job !== 'object') return null;

  const title = String(job.title || job.name || '').trim();
  const url = normalizeJobUrl(
    job.url || job.jobUrl || job.job_url || job.applyUrl || job.apply_url,
    entry.careers_url,
  );
  if (!title || !url) return null;

  return {
    title,
    url,
    company: String(job.company || entry.name || '').trim(),
    location: normalizeLocation(job.location || job.locations),
  };
}

async function runLocalParser(entry) {
  const parser = entry.parser || {};
  const args = buildParserArgs(entry);
  const timeout = Number(parser.timeout_ms || LOCAL_PARSER_TIMEOUT_MS);
  const maxBuffer = Number(parser.max_buffer_bytes || LOCAL_PARSER_MAX_BUFFER_BYTES);

  const { stdout } = await execFileAsync(parser.command, args, {
    timeout,
    maxBuffer,
    windowsHide: true,
  });

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('local parser returned invalid JSON');
  }

  const rawJobs = Array.isArray(payload) ? payload : payload.jobs || payload.results;
  if (!Array.isArray(rawJobs)) {
    throw new Error('local parser JSON must be an array or contain jobs[]/results[]');
  }

  return rawJobs
    .map(job => normalizeParserJob(job, entry))
    .filter(Boolean);
}

/** @type {Provider} */
export default {
  id: 'local-parser',

  detect(entry) {
    if (!entry.parser?.command) return null;
    // Security gate: whitelisted interpreter + in-repo script (or an in-repo
    // command), no inline-code flags, no options before the script.
    if (!isParserSafe(entry)) return null;

    return { url: entry.careers_url || 'local-parser' };
  },

  async fetch(entry) {
    // Reject argument-injection via interpolated values first (clear per-field
    // error), then re-check structural safety before spawning.
    assertSafeInterpolation(entry);
    if (!isParserSafe(entry)) {
      throw new Error('local-parser: unsafe parser configuration (interpreter allowlist / in-repo script required)');
    }
    return runLocalParser(entry);
  },
};
