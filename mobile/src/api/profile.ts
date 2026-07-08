import { API_URL } from "@/constants/config";
import { getItem, STORAGE_KEYS } from "@/utils/storage";
import { api } from "./client";
import type { ParsedProfile, UserProfile } from "@/types";

/** The caller's profile (auto-created + email/name-seeded on first hit). */
export async function getProfile(): Promise<UserProfile> {
  const data = await api.get<{ profile: UserProfile }>("/api/profile");
  return data.profile;
}

/** Partial update — send only the fields you're changing. */
export async function updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  const data = await api.put<{ profile: UserProfile }>("/api/profile", patch);
  return data.profile;
}

/** Parse an uploaded résumé file → structured fields to review before saving. */
export async function parseResumeFile(file: {
  uri: string;
  name: string;
  mimeType?: string;
}): Promise<ParsedProfile> {
  const token = await getItem(STORAGE_KEYS.authToken);
  const form = new FormData();
  // React Native FormData file shape.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "application/octet-stream",
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/api/profile/parse-resume`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Parse failed (${res.status})`);
  return (data?.parsed ?? {}) as ParsedProfile;
}

/** Parse pasted résumé text → structured fields. */
export async function parseResumeText(text: string): Promise<ParsedProfile> {
  const data = await api.post<{ parsed: ParsedProfile }>(
    "/api/profile/parse-resume",
    { text },
  );
  return data.parsed ?? {};
}

/** Best-effort import from a public LinkedIn profile URL. */
export async function importLinkedin(
  url: string,
): Promise<{ parsed: ParsedProfile; warning?: string }> {
  const data = await api.post<{ parsed: ParsedProfile; warning?: string }>(
    "/api/profile/import-linkedin",
    { url },
  );
  return { parsed: data.parsed ?? {}, warning: data.warning };
}
