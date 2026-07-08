import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Two responsibilities:
 *  1. CORS for /api/* so the mobile app (Expo web build on another port, or a
 *     real device) can call this backend cross-origin. Dev-friendly: reflects
 *     the request Origin. Tighten to an allowlist for production.
 *  2. Supabase session refresh + page-route auth gating for everything else.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- API routes: CORS only (bearer-token auth handled per-route) ---
  if (pathname.startsWith("/api")) {
    const origin = req.headers.get("origin") ?? "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    };

    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: cors });
    }

    const res = NextResponse.next();
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  }

  // --- Page routes: refresh session + gate protected routes ---
  return updateSession(req);
}

export const config = {
  /**
   * Run on API routes (CORS) and all page routes except Next internals and
   * static assets.
   */
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
