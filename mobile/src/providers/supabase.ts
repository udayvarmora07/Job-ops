import { SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from "@/constants/config";
import { getItem, removeItem, setItem } from "@/utils/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created Supabase client. Returns null when Supabase is not configured
 * (SUPABASE_URL / SUPABASE_ANON_KEY empty) so the app can run in dev bypass.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_ENABLED) return null;
  if (client) return client;

  // Require lazily so the dependency isn't pulled in when auth is disabled.
  const { createClient } = require("@supabase/supabase-js");

  const AsyncStorageShim = {
    getItem,
    setItem,
    removeItem,
  };

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorageShim,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}
