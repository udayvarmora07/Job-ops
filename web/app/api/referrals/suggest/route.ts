import { NextRequest, NextResponse } from "next/server";
import { suggestReferrals } from "@/lib/suggest";
import { withErrorJson } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export const POST = withErrorJson(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const company = String(body.company || "").trim();
  if (!company) {
    return NextResponse.json({ error: "company required" }, { status: 400 });
  }
  const result = suggestReferrals({
    company,
    role: String(body.role || "").trim(),
    location: body.location ? String(body.location).trim() : undefined,
    jobUrl: body.jobUrl ? String(body.jobUrl).trim() : undefined,
  });
  return NextResponse.json({ result });
});
