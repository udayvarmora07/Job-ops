import { NextRequest, NextResponse } from "next/server";
import { runTask } from "../../../../../lib-ai/run.mjs";
import { buildColdEmail, parseColdEmail } from "../../../../../lib-ai/tasks/cold-email.mjs";
import { listOutreach, nextTemplate, getTemplate } from "../../../../../lib-outreach/index.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // cold_email may fall back to a slow NIM model

/**
 * POST /api/outreach/compose
 * body: { company, role?, personName?, personTitle?, jd?, mode?, templateId? }
 * → { subject, body, templateId, templateName } — a draft-ready cold email. NEVER sends.
 *
 * Template selection: if `templateId` is provided it is used directly (user pin);
 * otherwise A/B rotation picks the least-used template across past outreach — same
 * logic as /api/outreach/from-post.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.company && !body.jd) {
    return NextResponse.json({ error: "company or jd required" }, { status: 400 });
  }
  try {
    // A/B rotation: pick least-used template, or honour a caller-pinned templateId.
    const forced = body.templateId ? getTemplate(body.templateId) : null;
    const template = forced || nextTemplate(listOutreach());

    const built = buildColdEmail({
      company: body.company || "",
      role: body.role || "",
      personName: body.personName || body.name || "",
      personTitle: body.personTitle || body.title || "",
      jd: body.jd || "",
      mode: body.mode === "speculative" ? "speculative" : "jd_specific",
      template: template ?? undefined,
    });
    const { text, model } = await runTask("cold_email", {
      system: built.system,
      prompt: built.prompt,
    });
    const { subject, body: emailBody } = parseColdEmail(text, built.signature);
    return NextResponse.json({
      subject,
      body: emailBody,
      templateId: template?.id ?? null,
      templateName: template?.name ?? null,
      model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
