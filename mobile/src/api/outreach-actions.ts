import { api } from "./client";
import type {
  CompanyEmailResult,
  ComposeResult,
  FindEmailResult,
  FromPostResult,
  ParsedHiringPost,
  ScannedPost,
} from "@/types";

/** Draft an outreach email for a company/role. */
export async function composeOutreach(params: {
  company?: string;
  role?: string;
  jd?: string;
  templateId?: string;
}): Promise<ComposeResult> {
  return api.post<ComposeResult>("/api/outreach/compose", params);
}

/** Find a person's email (external finders — uses credits). */
export async function findEmail(params: {
  name: string;
  company?: string;
  domain?: string;
}): Promise<FindEmailResult> {
  const data = await api.post<{ result: FindEmailResult }>("/api/outreach/find-email", params);
  return data.result;
}

/** Discover LinkedIn hiring posts matching the user's profile (uses Apify). */
export async function scanPosts(params: {
  maxPosts?: number;
  page?: number;
  fitOnly?: boolean;
} = {}): Promise<ScannedPost[]> {
  const data = await api.post<{ posts?: ScannedPost[] }>(
    "/api/outreach/scan-posts",
    { maxPosts: 20, fitOnly: true, ...params },
  );
  return data.posts ?? [];
}

/** Parse a pasted hiring post into structured fields + any emails found. */
export async function parsePost(
  post: string,
  comments = "",
): Promise<{ parsed: ParsedHiringPost | null; foundEmails: string[] }> {
  const data = await api.post<{
    parsed?: ParsedHiringPost;
    foundEmails?: string[];
  }>("/api/outreach/parse-post", { post, comments });
  return { parsed: data.parsed ?? null, foundEmails: data.foundEmails ?? [] };
}

/** Draft a cold email from a parsed hiring post (company + role + requirements). */
export async function composeFromPost(params: {
  company?: string;
  role?: string;
  jd?: string;
  requirements?: string[];
  personName?: string;
  personTitle?: string;
  mode?: "jd_specific" | "speculative";
}): Promise<FromPostResult> {
  return api.post<FromPostResult>("/api/outreach/from-post", params);
}

/** Find all indexed emails at a company/domain, ranked by confidence. */
export async function findCompanyEmails(params: {
  company?: string;
  domain?: string;
  deep?: boolean;
  targetType?: "hr" | "founder";
}): Promise<CompanyEmailResult> {
  const data = await api.post<{ result: CompanyEmailResult }>(
    "/api/outreach/find-company-emails",
    params,
  );
  return data.result;
}

/** Send an outreach email (really sends via the backend's SMTP). */
export async function sendOutreach(params: {
  to: string;
  subject: string;
  body: string;
  company?: string;
  role?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  return api.post<{ ok?: boolean; error?: string }>("/api/outreach/send", params);
}
