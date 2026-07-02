import { NextResponse } from "next/server";
import { parseApplications, parseJobs, listReports } from "@/lib/parsers";
import { listReferrals } from "@/lib/referrals";

export const dynamic = "force-dynamic";

const REACHED: Record<string, number> = {
  // how far each status has progressed through the funnel
  evaluated: 1,
  skip: 1,
  discarded: 1,
  applied: 2,
  responded: 3,
  interview: 4,
  offer: 5,
  rejected: 2, // a rejection implies at least an application was sent
};

export async function GET() {
  const apps = parseApplications();
  const jobs = parseJobs();
  const reports = listReports();
  const referrals = listReferrals();

  const stage = (a: { status: string }) =>
    REACHED[a.status.toLowerCase().trim()] ?? 1;

  const total = apps.length;
  const applied = apps.filter((a) => stage(a) >= 2).length;
  const responded = apps.filter((a) => stage(a) >= 3).length;
  const interview = apps.filter((a) => stage(a) >= 4).length;
  const offer = apps.filter((a) => stage(a) >= 5).length;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const scored = apps.filter((a) => a.scoreNum != null);
  const avgScore =
    scored.length > 0
      ? scored.reduce((s, a) => s + (a.scoreNum as number), 0) / scored.length
      : null;

  const byStatus: Record<string, number> = {};
  for (const a of apps) {
    const k = a.status || "Unknown";
    byStatus[k] = (byStatus[k] || 0) + 1;
  }

  const refByStatus: Record<string, number> = {};
  for (const r of referrals) refByStatus[r.status] = (refByStatus[r.status] || 0) + 1;

  return NextResponse.json({
    counts: {
      fetchedJobs: jobs.length,
      inPipeline: jobs.filter((j) => j.inPipeline && !j.processed).length,
      processed: jobs.filter((j) => j.processed).length,
      evaluated: total,
      reports: reports.length,
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
