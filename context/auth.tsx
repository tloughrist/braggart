import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the initial session check finishes (avoids an auth-screen flash). */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Guard against a stale session whose profile no longer exists (e.g. the
    // account was deleted, or the local DB was reset out from under the token).
    // Without a players row, owner-scoped writes fail with an FK error, so we
    // sign such sessions out and fall back to the sign-in screen.
    async function ensureProfile(s: Session | null): Promise<Session | null> {
      if (!s) return null;
      const { data, error } = await supabase
        .from('players')
        .select('id')
        .eq('id', s.user.id)
        .maybeSingle();
      // Fail open on transient errors; only sign out when the profile is truly absent.
      if (!error && !data) {
        await supabase.auth.signOut();
        return null;
      }
      return s;
    }

    // 1) hydrate from any persisted session, validating the profile exists
    supabase.auth.getSession().then(async ({ data }) => {
      const validated = await ensureProfile(data.session);
      if (!mounted) return;
      setSession(validated);
      setInitializing(false);
    });

    // 2) keep in sync with sign-in / sign-out / token-refresh events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    initializing,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password, displayName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: displayName ? { display_name: displayName } : undefined },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
