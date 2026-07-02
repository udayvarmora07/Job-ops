import { NextRequest, NextResponse } from "next/server";
import { discover } from "../../../../../lib-outreach/index.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // finder + verifier API calls can take a bit

/**
 * POST /api/outreach/find-email
 * body: { name, company?, domain?, deep? }
 * → ranked, verified decision-maker email candidates (discovery engine).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!body.company && !body.domain) {
    return NextResponse.json({ error: "company or domain required" }, { status: 400 });
  }
  try {
    const result = await discover({
      name: String(body.name),
      company: body.company ? String(body.company) : undefined,
      domain: body.domain ? String(body.domain) : undefined,
      deep: !!body.deep,
    });
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
