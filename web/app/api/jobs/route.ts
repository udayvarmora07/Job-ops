import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  const scanJobs = await prisma.scanHistory.findMany({
    where: { userId: uid },
    orderBy: { firstSeen: "desc" },
  });

  const pipelineItems = await prisma.pipelineItem.findMany({ where: { userId: uid } });
  const pipelineMap = new Map<string, (typeof pipelineItems)[number]>(
    pipelineItems.map((p: (typeof pipelineItems)[number]) => [p.url, p])
  );

  const jobs = scanJobs.map((s: (typeof scanJobs)[number]) => {
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
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  await prisma.$transaction([
    prisma.scanHistory.deleteMany({ where: { url, userId: uid } }),
    prisma.pipelineItem.deleteMany({ where: { url, userId: uid } }),
  ]);

  return NextResponse.json({ ok: true });
}
