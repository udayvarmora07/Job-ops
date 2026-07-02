import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const reports = await prisma.report.findMany({ orderBy: { num: "asc" } });
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: String(r.num).padStart(3, "0"),
      file: `${String(r.num).padStart(3, "0")}-${r.company.toLowerCase().replace(/\s+/g, "-")}-${r.createdAt.toISOString().slice(0, 10)}.md`,
      title: `# ${r.company} — ${r.role}`,
      company: r.company,
      role: r.role,
      date: r.createdAt.toISOString().slice(0, 10),
      score: r.score ? `${r.score}/5` : null,
      scoreNum: r.score,
      url: null,
      legitimacy: null,
      archetype: null,
      location: null,
    })),
  });
}
