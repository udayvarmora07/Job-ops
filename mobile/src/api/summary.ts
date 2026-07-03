import { api } from "./client";
import type { Summary } from "@/types";

export async function fetchSummary(): Promise<Summary> {
  return api.get<Summary>("/api/summary");
}
