import { api } from "./client";
import type { Job } from "@/types";

export async function fetchJobs(): Promise<Job[]> {
  const data = await api.get<{ jobs: Job[] }>("/api/jobs");
  return data.jobs ?? [];
}

export async function deleteJob(url: string): Promise<void> {
  await api.del("/api/jobs", { url });
}
