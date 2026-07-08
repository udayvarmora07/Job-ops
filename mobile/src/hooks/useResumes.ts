import { useQuery } from "@tanstack/react-query";
import { fetchResumes } from "@/api/resumes";

export const resumesKey = ["resumes"] as const;

export function useResumes() {
  return useQuery({ queryKey: resumesKey, queryFn: fetchResumes });
}
