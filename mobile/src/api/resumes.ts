import { API_URL } from "@/constants/config";
import { api } from "./client";
import { withDemoFallback } from "./demo-fallback";
import { demoResumes } from "./demo-data";
import type { ResumeGroup } from "@/types";

export async function fetchResumes(): Promise<{ groups: ResumeGroup[]; total: number }> {
  return withDemoFallback(async () => {
    const data = await api.get<{ groups: ResumeGroup[]; total: number }>("/api/resumes");
    return { groups: data.groups ?? [], total: data.total ?? 0 };
  }, { groups: demoResumes, total: demoResumes.reduce((s, g) => s + g.files.length, 0) });
}

/** Absolute URL to open/download a resume PDF (the API serves it). */
export function resumeFileUrl(relativeUrl: string): string {
  return relativeUrl.startsWith("http") ? relativeUrl : `${API_URL}${relativeUrl}`;
}
