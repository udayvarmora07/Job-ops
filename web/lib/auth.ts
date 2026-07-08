import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";

/**
 * Identity helper for API routes. Resolves the calling Supabase user from
 * EITHER the SSR cookie (web) OR an `Authorization: Bearer <token>` header
 * (mobile). This lets every route scope its data per user without caring which
 * client is calling.
 *
 * When Supabase is not configured (local/dev with no env), returns a stable
 * dev-user id so the app stays usable — mirroring the middleware's auth-disabled
 * behaviour.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Stable id used when Supabase auth is not configured (local dev). */
export const DEV_USER_ID = "dev-user";

/**
 * Resolve the caller's Supabase user id.
 *
 * - Web (cookie): uses the SSR Supabase client → `auth.getUser()`.
 * - Mobile (bearer): extracts the token from the Authorization header and
 *   verifies it via `supabase.auth.getUser(token)`.
 *
 * Returns the user id string, or `null` when anonymous / token invalid.
 */
export async function getUserId(req?: Request): Promise<string | null> {
  // Dev bypass — no Supabase configured.
  if (!SUPABASE_ENABLED) return DEV_USER_ID;

  // Mobile path: bearer token in the Authorization header. Verify the JWT
  // locally via getClaims (cached JWKS — no per-request network), falling back
  // to a direct /auth/v1/user lookup only if local verification isn't possible.
  const authHeader = req?.headers?.get("authorization") || req?.headers?.get("Authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.getClaims(token);
        if (!error && data?.claims?.sub) return String(data.claims.sub);
      } catch {
        // fall through
      }
      try {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY! },
        });
        if (resp.ok) {
          const user = await resp.json();
          if (user?.id) return user.id as string;
        }
      } catch {
        // fall through to cookie path
      }
    }
  }

  // Web path: SSR cookie-bound client. Verify the session JWT locally with
  // getClaims (cached JWKS) to avoid a Supabase round-trip on every request —
  // this was previously 0.5–8s per call. Fall back to getUser() only if local
  // verification isn't available (e.g. legacy symmetric JWT secret).
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims?.sub) return String(data.claims.sub);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Require an authenticated user. Returns the id, or throws a 401 NextResponse
 * for anonymous callers. Usage:
 *
 *   const uid = await requireUserId(req);          // string
 *   if (uid instanceof NextResponse) return uid;   // 401
 *
 * (We can't literally throw a Response, so we return a union; the caller checks
 * with `instanceof NextResponse`.)
 */
export async function requireUserId(
  req?: Request,
): Promise<string | NextResponse> {
  const id = await getUserId(req);
  if (id) return id;
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 },
  );
}
