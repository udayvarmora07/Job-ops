import { NextResponse } from "next/server";
import { listReports } from "@/lib/parsers";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ reports: listReports() });
}
