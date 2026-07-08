import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL } from "@/constants/config";
import { getItem, STORAGE_KEYS } from "@/utils/storage";
import { api } from "./client";
import type {
  EvaluateResult,
  GenerateCvResult,
  ResumeQa,
  ScanResult,
} from "@/types";

/** Evaluate a job description → creates a report + tracker entry. */
export async function evaluate(jd: string): Promise<EvaluateResult> {
  return api.post<EvaluateResult>("/api/evaluate-save", { jd });
}

/**
 * Run a generic AI text task (cover_letter, interview_prep, connection_notes).
 * The endpoint streams text; we read the full response once complete.
 */
export async function runAiTask(task: string, input: string): Promise<string> {
  const token = await getItem(STORAGE_KEYS.authToken);
  const res = await fetch(`${API_URL}/api/ai/${task}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `AI task failed (${res.status})`);
  return text;
}

/** Fetch the JD text for a supported job URL (greenhouse/lever/ashby). */
export async function fetchJd(url: string): Promise<string> {
  const data = await api.post<{ jd?: string; error?: string }>(
    "/api/outreach/fetch-jd",
    { url },
  );
  if (!data.jd) throw new Error(data.error || "Could not fetch the job description from that URL.");
  return data.jd;
}

/**
 * Trigger a portal scan. The endpoint streams SSE; on mobile we read the full
 * response once the scan completes and parse the `data:` events (no live
 * streaming needed — works on web and native alike).
 */
export async function triggerScan(): Promise<ScanResult> {
  const token = await getItem(STORAGE_KEYS.authToken);
  const res = await fetch(`${API_URL}/api/scan`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  const events = text
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => {
      try {
        return JSON.parse(l.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { type: string; id?: string; label?: string; new?: number; summary?: string; ok?: boolean; message?: string }[];

  const complete = events.find((e) => e.type === "complete");
  const error = events.find((e) => e.type === "error");
  const sources = events
    .filter((e) => e.type === "done")
    .map((e) => ({ id: e.id ?? "", label: e.label, new: e.new ?? null }));

  return {
    summary: complete?.summary ?? error?.message ?? "Scan finished.",
    ok: !error,
    sources,
  };
}

/** ATS / QA review of a saved résumé PDF by filename. */
export async function resumeQa(file: string): Promise<ResumeQa> {
  const data = await api.post<{ qa: ResumeQa | null }>("/api/resume-qa", { file });
  return data.qa ?? {};
}

/**
 * Generate a tailored résumé PDF (saved server-side to output/resumes). Returns
 * the saved filename/version from the response headers. The PDF body is ignored
 * on mobile — the résumé then appears in the Resumes screen.
 */
export async function generateCv(params: {
  jd: string;
  company?: string;
  role?: string;
  url?: string;
  instructions?: string;
}): Promise<GenerateCvResult> {
  const token = await getItem(STORAGE_KEYS.authToken);
  const res = await fetch(`${API_URL}/api/generate-cv-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let msg = `Generation failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* body was the PDF or empty */
    }
    throw new Error(msg);
  }
  return {
    savedFilename: res.headers.get("X-Saved-Filename"),
    savedVersion: res.headers.get("X-Saved-Version"),
  };
}

/**
 * Render a cover-letter PDF from text (POST /api/generate-cover-pdf → PDF
 * bytes), save it to the cache dir, and open the system share sheet so the
 * user can save/send it.
 */
export async function generateCoverPdf(text: string): Promise<void> {
  const token = await getItem(STORAGE_KEYS.authToken);
  const res = await fetch(`${API_URL}/api/generate-cover-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    let msg = `PDF export failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* body was the PDF or empty */
    }
    throw new Error(msg);
  }

  // Blob → base64 → file (RN has no Buffer; FileReader handles the encoding).
  const blob = await res.blob();
  const base64: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Could not read the PDF"));
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.readAsDataURL(blob);
  });

  const uri = `${FileSystem.cacheDirectory}cover-letter-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  }
}
