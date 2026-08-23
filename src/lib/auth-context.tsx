import { useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { usernameToEmail } from '@/lib/username';
import { AuthContext } from './auth-context-object';

export { AuthContext };
export type { AuthContextValue } from './auth-context-object';

async function resolveEmail(handle: string): Promise<string> {
  const trimmed = handle.trim();
  if (!trimmed) return '';
  // A real email (admin seed account) is used as-is; a bare handle (Hebrew or
  // English) is mapped to its synthetic ASCII email.
  return trimmed.includes('@') ? trimmed : usernameToEmail(trimmed);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (handle: string, password: string) => {
    const email = await resolveEmail(handle);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
