/**
 * lib-ai/json.mjs — tolerant JSON extraction for model output.
 *
 * Reasoning-capable models (gpt-5.5, deepseek-v4-pro, kimi) frequently wrap
 * their JSON in `<think>…</think>` blocks or markdown fences, and can truncate
 * the JSON when they hit the output-token ceiling. A naive
 * `JSON.parse(firstBrace..lastBrace)` throws on all of these and loses the whole
 * result. `extractJson` recovers a usable object from every one of these cases.
 */

/**
 * Balance an object/array string that was cut off mid-value: close any string
 * still open, then close every unclosed `{`/`[` in the right order.
 */
function closeOpen(str) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  let out = str;
  if (inStr) out += '"';
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']';
  }
  return out;
}

/** Strip trailing commas (`,}` / `,]`) that break strict JSON.parse. */
function stripTrailingCommas(str) {
  return str.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Parse a JSON object string that may be truncated. Tries, in order: the string
 * as-is, a fully-balanced version, then progressively shorter prefixes cut at
 * each `}` from the end and re-balanced — recovering every complete element up
 * to the truncation point (e.g. all fully-written issues before the cut).
 */
function looseParse(body) {
  const tryParse = (s) => {
    try {
      return JSON.parse(stripTrailingCommas(s));
    } catch {
      return undefined;
    }
  };

  let obj = tryParse(body);
  if (obj !== undefined) return obj;

  obj = tryParse(closeOpen(body));
  if (obj !== undefined) return obj;

  // Truncated mid-object: walk back to the last `}` that yields valid JSON once
  // its surrounding structures are closed.
  for (let i = body.length - 1; i >= 0; i--) {
    if (body[i] !== '}') continue;
    obj = tryParse(closeOpen(body.slice(0, i + 1)));
    if (obj !== undefined) return obj;
  }
  return null;
}

/**
 * Extract the first JSON object from arbitrary model text.
 * Handles `<think>` reasoning blocks, markdown code fences, surrounding prose,
 * and truncated output. Returns the parsed object, or `null` if nothing usable.
 *
 * @param {string} text
 * @returns {any|null}
 */
export function extractJson(text) {
  let raw = String(text ?? '');

  // Drop complete reasoning blocks emitted by reasoning models.
  raw = raw.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
  // If only a closing reasoning tag survives (opening got stripped/streamed off),
  // keep everything after it — the answer lives past the reasoning.
  const closeMatch = raw.match(/<\/think(?:ing)?>/i);
  if (closeMatch) raw = raw.slice(closeMatch.index + closeMatch[0].length);

  // Prefer a fenced block when the model wrapped its JSON in ```json … ```.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : raw;

  const start = body.indexOf('{');
  if (start === -1) return null;

  return looseParse(body.slice(start));
}
