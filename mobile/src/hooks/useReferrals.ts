import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addReferral, deleteReferral, fetchReferrals, type NewReferral } from "@/api/referrals";

export const referralsKey = ["referrals"] as const;

export function useReferrals() {
  return useQuery({ queryKey: referralsKey, queryFn: fetchReferrals });
}

export function useAddReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewReferral) => addReferral(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: referralsKey }),
  });
}

export function useDeleteReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReferral(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: referralsKey }),
  });
}
