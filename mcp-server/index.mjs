#!/usr/bin/env node
/**
 * mcp-server/index.mjs — career-ops AI exposed over the Model Context Protocol.
 *
 * This is the "use it from any app" surface. It wraps the shared lib-ai engine
 * as MCP tools so ANY MCP-capable client — Claude Code, Antigravity, Cursor,
 * Windsurf, etc. — can run career-ops AI tasks. One server, one NIM key, the
 * four frontier models routed per task by config/ai.yml.
 *
 * Transport: stdio (the client spawns this process). Wire it up via .mcp.json:
 *   { "mcpServers": { "career-ops-ai": { "command": "node",
 *       "args": ["mcp-server/index.mjs"], "cwd": "<repo>" } } }
 *
 * Run standalone for a sanity check:
 *   node mcp-server/index.mjs        # waits on stdio; Ctrl-C to exit
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { isAbsolute, join } from 'path';

import { runTask } from '../lib-ai/run.mjs';
import { buildEvaluateJob } from '../lib-ai/tasks/evaluate-job.mjs';
import { buildTask, hasBuilder } from '../lib-ai/tasks/index.mjs';
import { loadAiConfig, resolveChain, ROOT } from '../lib-ai/config.mjs';

// --- helpers ----------------------------------------------------------------
const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

/** Read inline text or a file path (resolved against the repo root if relative). */
function resolveInput({ text, file }) {
  if (text && text.trim()) return text.trim();
  if (file) {
    const p = isAbsolute(file) ? file : join(ROOT, file);
    if (!existsSync(p)) throw new Error(`File not found: ${p}`);
    return readFileSync(p, 'utf-8').trim();
  }
  throw new Error('Provide either "text" or "file".');
}

// --- server -----------------------------------------------------------------
const server = new McpServer({ name: 'career-ops-ai', version: '1.0.0' });

// 1) evaluate_job — full A–G job evaluation (DeepSeek V4 Pro by default)
server.registerTool(
  'evaluate_job',
  {
    title: 'Evaluate a job offer',
    description:
      'Score a job description against the user\'s CV/profile and return a full A–G ' +
      'evaluation report (match, level/strategy, comp, customization, interview plan, ' +
      'legitimacy) plus a machine-readable score summary. Heavy reasoning task — may take 1–3 min.',
    inputSchema: {
      jd: z.string().optional().describe('Job description text to evaluate.'),
      file: z.string().optional().describe('Path to a JD file (relative to the repo root or absolute).'),
      model: z.string().optional().describe('Override the model, e.g. "nim:z-ai/glm-5.1".'),
    },
  },
  async ({ jd, file, model }) => {
    try {
      const text = resolveInput({ text: jd, file });
      const { system, prompt } = buildEvaluateJob(text);
      const r = await runTask('evaluate_job', { system, prompt, modelOverride: model });
      return ok(`[model: ${r.model}]\n\n${r.text}`);
    } catch (err) {
      return fail(`evaluate_job failed: ${err.message}`);
    }
  }
);

// 2) summarize_report — light/cheap summary of a report or any long text (MiniMax M3)
server.registerTool(
  'summarize_report',
  {
    title: 'Summarize a report',
    description:
      'Condense an evaluation report (or any long text) into a short summary: verdict, ' +
      'score, top strengths, top gaps, and recommended next step.',
    inputSchema: {
      text: z.string().optional().describe('Report text to summarize.'),
      file: z.string().optional().describe('Path to a report file, e.g. "reports/001-acme-2026-06-22.md".'),
    },
  },
  async ({ text, file }) => {
    try {
      const input = resolveInput({ text, file });
      const r = await runTask('summarize_report', {
        system: 'You summarize career-ops job-evaluation reports. Be concise and factual.',
        prompt:
          'Summarize this report in <=120 words: verdict, score, top 2 strengths, top 2 gaps, ' +
          'and the single recommended next step.\n\n' + input,
      });
      return ok(`[model: ${r.model}]\n\n${r.text}`);
    } catch (err) {
      return fail(`summarize_report failed: ${err.message}`);
    }
  }
);

// 3) ai_run — run ANY task in config/ai.yml. Tasks with a builder
// (tailor_cv, cover_letter, draft_referral, interview_prep, evaluate_job) get
// the full career-ops context auto-assembled from the user's files.
server.registerTool(
  'ai_run',
  {
    title: 'Run any configured AI task',
    description:
      'Run a task from config/ai.yml. For tailor_cv / cover_letter / draft_referral / ' +
      'interview_prep / evaluate_job, pass the JD/brief as "input" and the candidate ' +
      'context is assembled automatically. For other tasks, "input" is sent as a raw prompt. ' +
      'Use list_ai_tasks to see all task names.',
    inputSchema: {
      task: z.string().describe('Task name from config/ai.yml (e.g. "cover_letter", "tailor_cv").'),
      input: z.string().describe('The JD / brief / prompt for the task.'),
      system: z.string().optional().describe('Optional system override (ignored when a builder applies).'),
      model: z.string().optional().describe('Override the model spec, e.g. "nim:z-ai/glm-5.1".'),
    },
  },
  async ({ task, input, system, model }) => {
    try {
      const built = hasBuilder(task) ? buildTask(task, input) : null;
      const opts = built
        ? { system: built.system, prompt: built.prompt, modelOverride: model }
        : { prompt: input, system, modelOverride: model };
      const r = await runTask(task, opts);
      return ok(`[model: ${r.model}]\n\n${r.text}`);
    } catch (err) {
      return fail(`ai_run failed: ${err.message}`);
    }
  }
);

// 4) list_ai_tasks — discovery, zero cost
server.registerTool(
  'list_ai_tasks',
  {
    title: 'List AI tasks and their models',
    description: 'Return every task in config/ai.yml with its ordered model fallback chain. No model call.',
    inputSchema: {},
  },
  async () => {
    try {
      const cfg = loadAiConfig();
      const lines = Object.keys(cfg.tasks).map((t) => `- ${t}: ${resolveChain(cfg, t).join(' | ')}`);
      const providers = Object.keys(cfg.providers).join(', ');
      return ok(`Providers: ${providers}\nDefault: ${cfg.default}\n\nTasks:\n${lines.join('\n')}`);
    } catch (err) {
      return fail(`list_ai_tasks failed: ${err.message}`);
    }
  }
);

// --- boot -------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
// Logs go to stderr so they never corrupt the stdio JSON-RPC stream.
console.error('career-ops-ai MCP server ready (stdio). Tools: evaluate_job, summarize_report, ai_run, list_ai_tasks');
