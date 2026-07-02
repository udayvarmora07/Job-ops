import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const scanJobs = await prisma.scanHistory.findMany({
    orderBy: { firstSeen: "desc" },
  });

  const pipelineItems = await prisma.pipelineItem.findMany();
  const pipelineMap = new Map(pipelineItems.map((p) => [p.url, p]));

  const jobs = scanJobs.map((s) => {
    const pipe = pipelineMap.get(s.url);
    return {
      url: s.url,
      company: s.company,
      role: s.title,
      portal: s.portal,
      location: s.location,
      firstSeen: s.firstSeen.toISOString().slice(0, 10),
      inPipeline: !!pipe,
      processed: pipe?.status === "done",
      source: pipe ? ("both" as const) : ("scan" as const),
      expRequired: null as string | null,
      expMinYears: null as number | null,
    };
  });

  return NextResponse.json({ jobs });
}

export async function DELETE(req: Request) {
  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  await prisma.$transaction([
    prisma.scanHistory.deleteMany({ where: { url } }),
    prisma.pipelineItem.deleteMany({ where: { url } }),
  ]);

  return NextResponse.json({ ok: true });
}
