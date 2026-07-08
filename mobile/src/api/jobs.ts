import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoJobs } from "./demo-data";
import type { Job } from "@/types";

export async function fetchJobs(): Promise<Job[]> {
  return withDemoFallback(async () => {
    const data = await api.get<{ jobs: Job[] }>("/api/jobs");
    return data.jobs ?? [];
  }, demoJobs);
}

export async function deleteJob(url: string): Promise<void> {
  await api.del("/api/jobs", { url });
}
