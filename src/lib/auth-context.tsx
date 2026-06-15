import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { usernameToEmail } from '@/lib/username';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Accepts either a real email or a bare username (the synthetic domain is appended automatically). */
  signIn: (handle: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

async function resolveEmail(handle: string): Promise<string> {
  const trimmed = handle.trim();
  if (!trimmed) return '';
  // A real email (admin seed account) is used as-is; a bare handle (Hebrew or
  // English) is mapped to its synthetic ASCII email.
  return trimmed.includes('@') ? trimmed : usernameToEmail(trimmed);
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
