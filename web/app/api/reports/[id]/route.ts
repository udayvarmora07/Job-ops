import { NextRequest, NextResponse } from "next/server";
import { readReport } from "@/lib/parsers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const report = readReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}
