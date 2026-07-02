import { NextRequest, NextResponse } from "next/server";
import {
  listReferrals,
  upsertReferral,
  deleteReferral,
} from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ referrals: listReferrals() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ref = upsertReferral(body);
  return NextResponse.json({ referral: ref });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = deleteReferral(id);
  return NextResponse.json({ ok });
}
