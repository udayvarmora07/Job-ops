import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoReports } from "./demo-data";
import type { Report } from "@/types";

export async function fetchReports(): Promise<Report[]> {
  return withDemoFallback(async () => {
    const data = await api.get<{ reports: Report[] }>("/api/reports");
    return data.reports ?? [];
  }, demoReports);
}

/** Full markdown content of a report by id (API returns { meta, body }). */
export async function fetchReportContent(id: string): Promise<string> {
  return withDemoFallback(async () => {
    const data = await api.get<{ meta?: unknown; body: string }>(
      `/api/reports/${encodeURIComponent(id)}`,
    );
    return data.body ?? "";
  }, "# Report preview unavailable offline\n\nConnect to the backend to read the full report.");
}
