import { useMutation } from "@tanstack/react-query";
import { aiTargets, connectionNotes, findPeople, suggestReferrals } from "@/api/referral-ai";

export function useSuggestReferrals() {
  return useMutation({
    mutationFn: ({ company, role }: { company: string; role: string }) =>
      suggestReferrals(company, role),
  });
}

export function useAiTargets() {
  return useMutation({
    mutationFn: ({ company, role }: { company: string; role: string }) => aiTargets(company, role),
  });
}

export function useConnectionNotes() {
  return useMutation({
    mutationFn: ({ company, role, persona }: { company: string; role: string; persona?: string }) =>
      connectionNotes(company, role, persona),
  });
}

export function useFindPeople() {
  return useMutation({
    mutationFn: ({ company, role }: { company: string; role: string }) => findPeople(company, role),
  });
}
