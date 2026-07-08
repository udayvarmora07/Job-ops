import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { SUPABASE_ENABLED } from "@/constants/config";
import { getSupabase } from "./supabase";
import { getItem, removeItem, setItem, STORAGE_KEYS } from "@/utils/storage";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

/** Social providers supported for OAuth sign-in. */
export type OAuthProvider = "google" | "github" | "linkedin_oidc";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** True when Supabase is configured; otherwise dev-bypass sign-in is used. */
  supabaseEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          const s = data.session;
          if (active && s) {
            await setItem(STORAGE_KEYS.authToken, s.access_token);
            setUser({
              id: s.user.id,
              email: s.user.email ?? "",
              name: (s.user.user_metadata?.name as string) ?? undefined,
            });
          }
        } else {
          const raw = await getItem(STORAGE_KEYS.authUser);
          if (active && raw) setUser(JSON.parse(raw) as AuthUser);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const s = data.session!;
      await setItem(STORAGE_KEYS.authToken, s.access_token);
      setUser({ id: s.user.id, email: s.user.email ?? email });
      return;
    }
    // Dev bypass: accept any credentials, persist a local session.
    const devUser: AuthUser = { id: "dev-user", email };
    await setItem(STORAGE_KEYS.authUser, JSON.stringify(devUser));
    await setItem(STORAGE_KEYS.authToken, "dev-token");
    setUser(devUser);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return;
    }
    const devUser: AuthUser = { id: "dev-user", email };
    await setItem(STORAGE_KEYS.authUser, JSON.stringify(devUser));
    await setItem(STORAGE_KEYS.authToken, "dev-token");
    setUser(devUser);
  }, []);

  const signInWithProvider = useCallback(async (provider: OAuthProvider) => {
    const supabase = getSupabase();
    if (!supabase) {
      // Dev bypass: simulate a social sign-in.
      const devUser: AuthUser = { id: "dev-user", email: `${provider}@dev.local` };
      await setItem(STORAGE_KEYS.authUser, JSON.stringify(devUser));
      await setItem(STORAGE_KEYS.authToken, "dev-token");
      setUser(devUser);
      return;
    }

    // Deep link back into the app (e.g. jobops://auth-callback).
    const redirectTo = Linking.createURL("auth-callback");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw new Error(error.message);
    if (!data?.url) throw new Error("Could not start sign-in");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      throw new Error("Sign-in was cancelled");
    }

    // PKCE: the redirect carries a `code` we exchange for a session.
    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;
    if (!code || typeof code !== "string") {
      throw new Error("No authorization code returned");
    }

    const { data: sess, error: exErr } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw new Error(exErr.message);

    const s = sess.session;
    if (!s) throw new Error("No session returned");
    await setItem(STORAGE_KEYS.authToken, s.access_token);
    setUser({
      id: s.user.id,
      email: s.user.email ?? "",
      name: (s.user.user_metadata?.name as string) ?? undefined,
    });
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw new Error(error.message);
    }
    // Dev bypass: no-op.
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    await removeItem(STORAGE_KEYS.authToken);
    await removeItem(STORAGE_KEYS.authUser);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      supabaseEnabled: SUPABASE_ENABLED,
      signIn,
      signUp,
      signInWithProvider,
      signOut,
      resetPassword,
    }),
    [user, loading, signIn, signUp, signInWithProvider, signOut, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
