import { useQuery } from "@tanstack/react-query";
import { fetchSummary } from "@/api/summary";

export const summaryKey = ["summary"] as const;

export function useSummary() {
  return useQuery({ queryKey: summaryKey, queryFn: fetchSummary });
}
