import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  importLinkedin,
  parseResumeFile,
  parseResumeText,
  updateProfile,
} from "@/api/profile";
import type { UserProfile } from "@/types";

export const profileKey = ["profile"] as const;

/** The current user's editable profile. */
export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: getProfile });
}

/** Save a partial profile update; refreshes the cached profile on success. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => updateProfile(patch),
    onSuccess: (profile) => qc.setQueryData(profileKey, profile),
  });
}

/** Parse an uploaded résumé file into structured fields for review. */
export function useParseResumeFile() {
  return useMutation({
    mutationFn: (file: Parameters<typeof parseResumeFile>[0]) => parseResumeFile(file),
  });
}

/** Parse pasted résumé text into structured fields for review. */
export function useParseResumeText() {
  return useMutation({ mutationFn: (text: string) => parseResumeText(text) });
}

/** Best-effort import from a LinkedIn URL. */
export function useImportLinkedin() {
  return useMutation({ mutationFn: (url: string) => importLinkedin(url) });
}
