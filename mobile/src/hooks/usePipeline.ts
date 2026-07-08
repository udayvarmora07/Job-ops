import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addPipelineUrl, fetchPipeline, removePipelineUrl } from "@/api/pipeline";

export const pipelineKey = ["pipeline"] as const;

export function usePipeline() {
  return useQuery({ queryKey: pipelineKey, queryFn: fetchPipeline });
}

export function useAddPipelineUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => addPipelineUrl(url),
    onSuccess: () => qc.invalidateQueries({ queryKey: pipelineKey }),
  });
}

export function useRemovePipelineUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => removePipelineUrl(url),
    onSuccess: () => qc.invalidateQueries({ queryKey: pipelineKey }),
  });
}
