import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Paths that never require authentication. */
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/forgot-password", "/onboarding"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and gates protected
 * page routes. Returns a response the caller should return (or attach headers
 * to). When Supabase is not configured, auth is disabled and every route is
 * public so the dashboard stays usable in local/dev.
 *
 * Two gates:
 *  1. Unauthenticated → /login
 *  2. Authenticated but essentials incomplete → /onboarding
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Auth disabled (no Supabase env) → don't gate anything.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated user hitting a protected page → send to /login.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting an auth page → send to the dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Onboarding gate: authenticated user without essentials → /onboarding.
  // Skip for /onboarding itself, /auth/* (OAuth callback), and /api/* (API
  // routes handle their own auth via getUserId).
  if (
    user &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/api")
  ) {
    try {
      // Check the UserProfile via a lightweight DB query through the API.
      // We use the supabase client's auth token to call our own status route.
      // This avoids importing Prisma into the edge middleware runtime.
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const statusUrl = new URL("/api/profile/status", request.url);
        const statusResp = await fetch(statusUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Cookie: request.headers.get("cookie") || "",
          },
        });
        if (statusResp.ok) {
          const status = await statusResp.json();
          if (!status.essentialsComplete && pathname !== "/onboarding") {
            const url = request.nextUrl.clone();
            url.pathname = "/onboarding";
            url.search = "";
            return NextResponse.redirect(url);
          }
        }
      }
    } catch {
      // If the status check fails, let the user through — don't block on
      // transient errors. The route-level auth will catch real issues.
    }
  }

  return response;
}
