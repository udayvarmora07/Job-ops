import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoApplications } from "./demo-data";
import type { Application } from "@/types";

export async function fetchApplications(): Promise<Application[]> {
  return withDemoFallback(async () => {
    const data = await api.get<{ applications: Application[] }>("/api/applications");
    return data.applications ?? [];
  }, demoApplications);
}

export async function updateApplicationStatus(
  num: string,
  status: string,
): Promise<void> {
  await api.patch("/api/applications", { num, status });
}

export interface NewApplication {
  company: string;
  role?: string;
  url?: string;
  status?: string;
}

export async function addApplication(data: NewApplication): Promise<void> {
  await api.post("/api/applications", data);
}
