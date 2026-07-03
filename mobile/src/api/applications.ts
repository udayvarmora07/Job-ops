import { api } from "./client";
import type { Application } from "@/types";

export async function fetchApplications(): Promise<Application[]> {
  const data = await api.get<{ applications: Application[] }>("/api/applications");
  return data.applications ?? [];
}

export async function updateApplicationStatus(
  num: string,
  status: string,
): Promise<void> {
  await api.patch("/api/applications", { num, status });
}
