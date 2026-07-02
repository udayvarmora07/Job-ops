import { NextRequest, NextResponse } from "next/server";
import { runTask } from "../../../../../lib-ai/run.mjs";
import {
  buildParseHiringPost,
  parseHiringPostJson,
  extractEmails,
} from "../../../../../lib-ai/tasks/parse-hiring-post.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/outreach/parse-post
 * body: { post: string, comments?: string }
 * → structured { company, role, requirements, email, applyMethod, ... } parsed
 *   from a pasted LinkedIn "we're hiring" post. NEVER sends anything.
 *
 * The regex pre-pass guarantees we surface any apply email even if the model's
 * JSON misses it; the model fills the role/requirements/contact fields.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const post = typeof body.post === "string" ? body.post.trim() : "";
  const comments = typeof body.comments === "string" ? body.comments.trim() : "";
  if (!post) {
    return NextResponse.json({ error: "post text required" }, { status: 400 });
  }

  // Always-available regex fallback (works even if the model call fails).
  const foundEmails = extractEmails(`${post}\n${comments}`);

  try {
    const built = buildParseHiringPost({ post, comments });
    const { text, model } = await runTask("parse_hiring_post", {
      system: built.system,
      prompt: built.prompt,
      temperature: 0.1,
    });
    const parsed = parseHiringPostJson(text);
    if (!parsed) {
      return NextResponse.json(
        { error: "could not parse post into JSON", foundEmails },
        { status: 422 }
      );
    }
    // If the model didn't lock an email but the regex found exactly one, use it.
    if (!parsed.email && foundEmails.length === 1) {
      parsed.email = foundEmails[0];
      if (parsed.applyMethod === "unknown") parsed.applyMethod = "email";
    }
    return NextResponse.json({ parsed, foundEmails, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Degrade gracefully: hand back whatever the regex found so the UI still works.
    return NextResponse.json({ error: msg, foundEmails }, { status: 500 });
  }
}
