import { NextRequest, NextResponse } from "next/server";
import { scanPosts } from "../../../../../lib-outreach/index.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Apify run-sync can take a while

// Default discovery queries — recruiter "send your CV" hiring posts for the
// user's target roles, India + remote. Override by passing `queries` in the body.
const DEFAULT_QUERIES = [
  'hiring DevOps Engineer "send your resume" India',
  'hiring SRE OR "Site Reliability" "share your CV" remote',
  'hiring "Platform Engineer" OR "Cloud Engineer" "drop your resume" India remote',
];

/**
 * POST /api/outreach/scan-posts
 * body: { queries?: string[], maxPosts?: number, postedLimit?: string, emailOnly?: boolean }
 * → { posts, stats } — fresh LinkedIn hiring posts (deduped) with apply emails.
 *   NEVER sends; just surfaces posts for review.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const queries =
    Array.isArray(body.queries) && body.queries.length
      ? body.queries.map(String)
      : DEFAULT_QUERIES;
  const maxPosts = Number.isFinite(body.maxPosts) ? Math.min(50, Math.max(1, body.maxPosts)) : 20;

  try {
    const result = await scanPosts({
      queries,
      maxPosts,
      postedLimit: typeof body.postedLimit === "string" ? body.postedLimit : "week",
      emailOnly: body.emailOnly !== false,
      fitOnly: body.fitOnly !== false, // default: only profile-fitting posts
      page: Number.isFinite(body.page) ? body.page : 1,
    });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const status = e.code === "NO_APIFY_TOKEN" ? 400 : 502;
    return NextResponse.json(
      { error: e.message || String(err), code: e.code || "" },
      { status }
    );
  }
}
