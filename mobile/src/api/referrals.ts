import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoReferrals } from "./demo-data";
import type { Referral } from "@/types";

export async function fetchReferrals(): Promise<Referral[]> {
  return withDemoFallback(async () => {
    const data = await api.get<{ referrals: Referral[] }>("/api/referrals");
    return data.referrals ?? [];
  }, demoReferrals);
}

export interface NewReferral {
  company: string;
  role?: string;
  contact?: string;
  channel?: string;
  status?: string;
  note?: string;
}

export async function addReferral(data: NewReferral): Promise<void> {
  await api.post("/api/referrals", data);
}

export async function deleteReferral(id: string): Promise<void> {
  await api.del(`/api/referrals?id=${encodeURIComponent(id)}`);
}
