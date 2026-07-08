import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  composeFromPost,
  composeOutreach,
  findCompanyEmails,
  findEmail,
  parsePost,
  scanPosts,
  sendOutreach,
} from "@/api/outreach-actions";
import { outreachKey } from "./useOutreach";

export function useComposeOutreach() {
  return useMutation({ mutationFn: composeOutreach });
}

export function useFindEmail() {
  return useMutation({ mutationFn: findEmail });
}

/** Discover LinkedIn hiring posts that fit the profile. */
export function useScanPosts() {
  return useMutation({ mutationFn: scanPosts });
}

/** Parse a pasted hiring post into structured fields. */
export function useParsePost() {
  return useMutation({
    mutationFn: ({ post, comments }: { post: string; comments?: string }) =>
      parsePost(post, comments),
  });
}

/** Draft a cold email from a parsed hiring post. */
export function useComposeFromPost() {
  return useMutation({ mutationFn: composeFromPost });
}

/** Find all indexed emails at a company/domain. */
export function useFindCompanyEmails() {
  return useMutation({ mutationFn: findCompanyEmails });
}

export function useSendOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendOutreach,
    onSuccess: () => qc.invalidateQueries({ queryKey: outreachKey }),
  });
}
