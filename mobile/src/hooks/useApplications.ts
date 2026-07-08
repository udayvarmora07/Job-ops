import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addApplication, fetchApplications, updateApplicationStatus, type NewApplication } from "@/api/applications";

export const applicationsKey = ["applications"] as const;

export function useApplications() {
  return useQuery({ queryKey: applicationsKey, queryFn: fetchApplications });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ num, status }: { num: string; status: string }) =>
      updateApplicationStatus(num, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: applicationsKey }),
  });
}

export function useAddApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewApplication) => addApplication(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: applicationsKey }),
  });
}
