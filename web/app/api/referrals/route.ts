import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const referrals = await prisma.referral.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    referrals: referrals.map((r) => ({
      id: String(r.id),
      company: r.company,
      role: r.role || "",
      contact: r.contact || "",
      channel: r.channel || "",
      status: r.status,
      jobUrl: "",
      note: r.notes || "",
      askedDate: null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ref = await prisma.referral.create({
    data: {
      company: body.company || "",
      role: body.role || null,
      contact: body.contact || null,
      channel: body.channel || "LinkedIn",
      status: body.status || "to_ask",
      notes: body.note || null,
    },
  });
  return NextResponse.json({
    referral: {
      id: String(ref.id),
      company: ref.company,
      role: ref.role || "",
      contact: ref.contact || "",
      channel: ref.channel || "",
      status: ref.status,
      jobUrl: "",
      note: ref.notes || "",
      askedDate: null,
      updatedAt: ref.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.referral.deleteMany({ where: { id: parseInt(id, 10) } });
  return NextResponse.json({ ok: true });
}
