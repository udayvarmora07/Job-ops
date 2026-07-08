import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoPipeline } from "./demo-data";
import type { PipelineItem } from "@/types";

export async function fetchPipeline(): Promise<PipelineItem[]> {
  return withDemoFallback(async () => {
    const data = await api.get<{ pending: PipelineItem[] }>("/api/pipeline");
    return data.pending ?? [];
  }, demoPipeline);
}

export async function addPipelineUrl(url: string): Promise<void> {
  await api.post("/api/pipeline", { url });
}

export async function removePipelineUrl(url: string): Promise<void> {
  await api.del("/api/pipeline", { url });
}
