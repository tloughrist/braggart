import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { auth as authApi, type Session, type User } from '@/lib/api';

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

    // Hydrate from any persisted session, but guard against a stale token whose
    // profile no longer exists (deleted account, or the local DB was reset out
    // from under it) — without a players row, owner-scoped writes fail with an
    // FK error, so sign such sessions out and fall back to the sign-in screen.
    authApi.getSession().then(async (s) => {
      let valid = s;
      if (s && !(await authApi.profileExists(s.user.id))) {
        await authApi.signOut();
        valid = null;
      }
      if (!mounted) return;
      setSession(valid);
      setInitializing(false);
    });

    // Keep in sync with sign-in / sign-out / token-refresh events.
    const unsubscribe = authApi.onAuthStateChange(setSession);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    initializing,
    signIn: authApi.signIn,
    signUp: authApi.signUp,
    signOut: authApi.signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
