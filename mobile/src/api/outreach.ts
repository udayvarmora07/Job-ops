import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoOutreach } from "./demo-data";
import type { Outreach } from "@/types";

export async function fetchOutreach(): Promise<Outreach[]> {
  return withDemoFallback(async () => {
    const data = await api.get<{ outreach: Outreach[] }>("/api/outreach");
    return data.outreach ?? [];
  }, demoOutreach);
}
