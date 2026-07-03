import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJob, fetchJobs } from "@/api/jobs";

export const jobsKey = ["jobs"] as const;

export function useJobs() {
  return useQuery({ queryKey: jobsKey, queryFn: fetchJobs });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => deleteJob(url),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobsKey }),
  });
}
