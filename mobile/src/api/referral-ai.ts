import { api } from "./client";
import type {
  AiTargetsResult,
  ConnectionNotesResult,
  FindPeopleResult,
  SuggestResult,
} from "@/types";

/** Rule-based referral personas (instant, no AI cost). */
export async function suggestReferrals(company: string, role: string): Promise<SuggestResult> {
  const data = await api.post<{ result: SuggestResult }>("/api/referrals/suggest", { company, role });
  return data.result;
}

/** AI-generated referral target personas (cached server-side). */
export async function aiTargets(company: string, role: string): Promise<AiTargetsResult> {
  return api.post<AiTargetsResult>("/api/referrals/ai-targets", { company, role });
}

/** Two AI LinkedIn connection notes + a follow-up DM. */
export async function connectionNotes(
  company: string,
  role: string,
  persona?: string,
): Promise<ConnectionNotesResult> {
  return api.post<ConnectionNotesResult>("/api/referrals/connection-notes", { company, role, persona });
}

/** Real people via the off-account LinkedIn scraper (Apify — uses credits). */
export async function findPeople(company: string, role: string): Promise<FindPeopleResult> {
  return api.post<FindPeopleResult>("/api/referrals/find-people", { company, role });
}
