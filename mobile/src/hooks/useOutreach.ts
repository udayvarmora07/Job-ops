import { useQuery } from "@tanstack/react-query";
import { fetchOutreach } from "@/api/outreach";

export const outreachKey = ["outreach"] as const;

export function useOutreach() {
  return useQuery({ queryKey: outreachKey, queryFn: fetchOutreach });
}
