import { NextResponse } from "next/server";
import { runTask } from "../../../../../lib-ai/run.mjs";
import { buildConnectionNotes } from "../../../../../lib-ai/tasks/connection-notes.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function extractJson(text: string) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e > s) return text.slice(s, e + 1);
  return text.trim();
}

export async function POST(req: Request) {
  let body: { company?: string; role?: string; persona?: string; why?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const company = (body.company || "").trim();
  const role = (body.role || "").trim();
  const persona = (body.persona || "").trim();
  if (!company) return NextResponse.json({ error: "company required" }, { status: 400 });

  try {
    const { system, prompt } = buildConnectionNotes({ company, role, persona, why: body.why });
    const r = await runTask("connection_notes", { system, prompt, maxOutputTokens: 1024 });
    const raw = extractJson(r.text ?? "");
    const notes = JSON.parse(raw);
    return NextResponse.json({ ok: true, ...notes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
