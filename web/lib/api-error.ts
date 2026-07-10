import { NextResponse } from "next/server";

/**
 * Wrap an API route handler so any *unhandled* thrown error becomes a structured
 * JSON 500 instead of Next.js's default HTML error page (which API/mobile
 * clients can't parse — see e2e-master-bug-report L1). Handlers that already
 * return their own NextResponse (including 4xx) are passed through untouched.
 *
 * Usage:
 *   export const GET = withErrorJson(async (req) => { ... });
 */
export function withErrorJson<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error("[api] unhandled route error:", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
