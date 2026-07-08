import { useQuery } from "@tanstack/react-query";
import { fetchReportContent, fetchReports } from "@/api/reports";

export const reportsKey = ["reports"] as const;

export function useReports() {
  return useQuery({ queryKey: reportsKey, queryFn: fetchReports });
}

export function useReportContent(id: string | undefined) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchReportContent(id as string),
    enabled: !!id,
  });
}
