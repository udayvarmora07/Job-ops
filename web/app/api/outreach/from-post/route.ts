import { NextRequest, NextResponse } from "next/server";
import { runTask } from "../../../../../lib-ai/run.mjs";
import { buildColdEmail, parseColdEmail } from "../../../../../lib-ai/tasks/cold-email.mjs";
import { listOutreach, nextTemplate, getTemplate } from "../../../../../lib-outreach/index.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/outreach/from-post
 *
 * Compose a JD-tailored cold-mail DRAFT for a hiring post, using one of the 5
 * templates chosen by even A/B rotation (the least-used template across tracked
 * outreach). Returns the draft + the chosen template id so the UI can preview it
 * and, on confirm, log it via POST /api/outreach with that templateId.
 *
 * NEVER sends. The résumé attachment is generated separately by the existing
 * /api/generate-cv-pdf flow (the UI wires both).
 *
 * body: { company, role?, email?, personName?, personTitle?, requirements?: string[],
 *         jd?, workMode?, mode?, templateId? (force a specific template) }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const jd =
    (typeof body.jd === "string" && body.jd.trim()) ||
    (Array.isArray(body.requirements) ? body.requirements.filter(Boolean).join("\n- ") : "");
  if (!company && !jd) {
    return NextResponse.json({ error: "company or jd/requirements required" }, { status: 400 });
  }

  try {
    // A/B: even rotation across past outreach, unless the caller pins a template.
    const forced = body.templateId ? getTemplate(body.templateId) : null;
    const template = forced || nextTemplate(listOutreach());
    if (!template) {
      return NextResponse.json({ error: "no template available" }, { status: 500 });
    }

    const built = buildColdEmail({
      company,
      role: typeof body.role === "string" ? body.role : "",
      personName: typeof body.personName === "string" ? body.personName : "",
      personTitle: typeof body.personTitle === "string" ? body.personTitle : "",
      jd: jd ? `- ${jd}` : "",
      mode: body.mode === "speculative" ? "speculative" : "jd_specific",
      template,
      workMode: typeof body.workMode === "string" ? body.workMode : "",
    });

    const { text, model } = await runTask("cold_email", {
      system: built.system,
      prompt: built.prompt,
    });
    const { subject, body: emailBody } = parseColdEmail(text, built.signature);

    return NextResponse.json({
      subject,
      body: emailBody,
      templateId: template.id,
      templateName: template.name,
      model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
