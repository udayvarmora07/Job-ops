import Constants from "expo-constants";

type Extra = {
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Base URL of the Career-Ops / Jobops Next.js backend.
 * Override per-environment via app.json `extra.apiUrl` or EXPO_PUBLIC_API_URL.
 *
 * Note: on a physical device "localhost" points at the phone, not your dev
 * machine — use your machine's LAN IP (e.g. http://192.168.1.20:3000).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:3000";

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";

/** Supabase auth is optional; when unconfigured the app runs in dev bypass. */
export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const FEATURES = {
  pushNotifications: false, // enabled in Phase 2
  offlineCache: false, // enabled in Phase 3
} as const;
