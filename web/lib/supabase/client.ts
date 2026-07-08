import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Reads the public URL + anon key from
 * NEXT_PUBLIC_* env vars. Safe to call in Client Components.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** True when Supabase env vars are configured. */
export const SUPABASE_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
