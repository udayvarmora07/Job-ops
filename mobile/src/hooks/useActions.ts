import { useMutation, useQueryClient } from "@tanstack/react-query";
import { evaluate, fetchJd, generateCoverPdf, generateCv, resumeQa, runAiTask, triggerScan } from "@/api/actions";
import { applicationsKey } from "./useApplications";
import { reportsKey } from "./useReports";
import { summaryKey } from "./useSummary";
import { jobsKey } from "./useJobs";
import { resumesKey } from "./useResumes";

/** Evaluate a pasted JD; refreshes reports/applications/summary on success. */
export function useEvaluate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jd: string) => evaluate(jd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportsKey });
      qc.invalidateQueries({ queryKey: applicationsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    },
  });
}

/** Fetch JD text from a job URL. */
export function useFetchJd() {
  return useMutation({ mutationFn: (url: string) => fetchJd(url) });
}

/** Trigger a portal scan; refreshes jobs/summary when done. */
export function useScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => triggerScan(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    },
  });
}

/** Run an ATS/QA review of a résumé file. */
export function useResumeQa() {
  return useMutation({ mutationFn: (file: string) => resumeQa(file) });
}

/** Run a generic AI text task (cover_letter, interview_prep, connection_notes). */
export function useAiTask() {
  return useMutation({
    mutationFn: ({ task, input }: { task: string; input: string }) => runAiTask(task, input),
  });
}

/** Export cover-letter text as a PDF and open the share sheet. */
export function useGenerateCoverPdf() {
  return useMutation({ mutationFn: (text: string) => generateCoverPdf(text) });
}

/** Generate a tailored résumé; refreshes the résumé library on success. */
export function useGenerateCv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof generateCv>[0]) => generateCv(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: resumesKey }),
  });
}
