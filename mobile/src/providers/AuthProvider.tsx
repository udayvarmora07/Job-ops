import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SUPABASE_ENABLED } from "@/constants/config";
import { getSupabase } from "./supabase";
import { getItem, removeItem, setItem, STORAGE_KEYS } from "@/utils/storage";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** True when Supabase is configured; otherwise dev-bypass sign-in is used. */
  supabaseEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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
      signOut,
      resetPassword,
    }),
    [user, loading, signIn, signUp, signOut, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
