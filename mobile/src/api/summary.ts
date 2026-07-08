import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoSummary } from "./demo-data";
import type { Summary } from "@/types";

export async function fetchSummary(): Promise<Summary> {
  return withDemoFallback(() => api.get<Summary>("/api/summary"), demoSummary);
}
