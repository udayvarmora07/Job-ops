import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { withErrorJson } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const REACHED: Record<string, number> = {
  evaluated: 1,
  skip: 1,
  discarded: 1,
  applied: 2,
  responded: 3,
  interview: 4,
  offer: 5,
  rejected: 2,
};

async function summaryHandler(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  const [applications, scanCount, pipelineCount, reportCount, referrals] =
    await Promise.all([
      prisma.application.findMany({ where: { userId: uid } }),
      prisma.scanHistory.count({ where: { userId: uid } }),
      prisma.pipelineItem.count({ where: { userId: uid } }),
      prisma.report.count({ where: { userId: uid } }),
      prisma.referral.findMany({ where: { userId: uid } }),
    ]);

  const total = applications.length;
  const applied = applications.filter((a) => (REACHED[a.status.toLowerCase().trim()] ?? 1) >= 2).length;
  const responded = applications.filter((a) => (REACHED[a.status.toLowerCase().trim()] ?? 1) >= 3).length;
  const interview = applications.filter((a) => (REACHED[a.status.toLowerCase().trim()] ?? 1) >= 4).length;
  const offer = applications.filter((a) => (REACHED[a.status.toLowerCase().trim()] ?? 1) >= 5).length;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const scored = applications.filter((a) => a.score != null);
  const avgScore =
    scored.length > 0
      ? scored.reduce((s, a) => s + (a.score as number), 0) / scored.length
      : null;

  const byStatus: Record<string, number> = {};
  for (const a of applications) {
    const k = a.status || "Unknown";
    byStatus[k] = (byStatus[k] || 0) + 1;
  }

  const refByStatus: Record<string, number> = {};
  for (const r of referrals) refByStatus[r.status] = (refByStatus[r.status] || 0) + 1;

  return NextResponse.json({
    counts: {
      fetchedJobs: scanCount,
      inPipeline: await prisma.pipelineItem.count({ where: { status: "pending", userId: uid } }),
      processed: await prisma.pipelineItem.count({ where: { status: "done", userId: uid } }),
      evaluated: total,
      reports: reportCount,
      referrals: referrals.length,
    },
    funnel: [
      { label: "Evaluated", count: total, pct: 100 },
      { label: "Applied", count: applied, pct: pct(applied, total) },
      { label: "Responded", count: responded, pct: pct(responded, applied) },
      { label: "Interview", count: interview, pct: pct(interview, applied) },
      { label: "Offer", count: offer, pct: pct(offer, applied) },
    ],
    rates: {
      response: pct(responded, applied),
      interview: pct(interview, applied),
      offer: pct(offer, applied),
    },
    avgScore,
    byStatus,
    refByStatus,
  });
}

export const GET = withErrorJson(summaryHandler);
