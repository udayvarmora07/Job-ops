import { NextRequest, NextResponse } from "next/server";
import { discoverCompany } from "../../../../../lib-outreach/index.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/outreach/find-company-emails
 * body: { company?, domain?, deep? }
 * → all indexed emails at the company domain, verified and ranked by confidence %.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.company && !body.domain) {
    return NextResponse.json(
      { error: "company name or domain required" },
      { status: 400 }
    );
  }
  try {
    const result = await discoverCompany({
      company: body.company ? String(body.company) : undefined,
      domain: body.domain ? String(body.domain) : undefined,
      deep: !!body.deep,
      targetType: body.targetType === 'founder' ? 'founder' : 'hr',
    });
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
