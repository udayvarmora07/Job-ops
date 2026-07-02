import { streamTask } from "../../../../../lib-ai/stream.mjs";
import { buildTask, hasBuilder } from "../../../../../lib-ai/tasks/index.mjs";

// AI calls need the Node runtime and must never be statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // heavy reasoning tasks can run minutes

/**
 * POST /api/ai/:task   body: { input: string, model?: string }
 * Streams the model's output as plain text. For builder tasks (evaluate_job,
 * tailor_cv, cover_letter, draft_referral, interview_prep) the full jobops
 * context is assembled from the user's files automatically.
 */
export async function POST(
  req: Request,
  { params }: { params: { task: string } }
) {
  const task = params.task;
  let body: { input?: string; model?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const input = (body.input || "").trim();
  if (!input) {
    return new Response("Missing 'input' in request body.", { status: 400 });
  }

  try {
    const built = hasBuilder(task) ? buildTask(task, input) : null;
    const opts = built
      ? { system: built.system, prompt: built.prompt, modelOverride: body.model }
      : { prompt: input, modelOverride: body.model };

    const { result, model } = await streamTask(task, opts);
    const res = result.toTextStreamResponse();
    res.headers.set("x-ai-model", model);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`AI task "${task}" failed: ${msg}`, { status: 500 });
  }
}
