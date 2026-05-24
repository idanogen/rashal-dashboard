import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentProfile } from '@/hooks/useProfile';
import { Loader2, ShieldAlert } from 'lucide-react';

export function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!profile || profile.disabled) {
    return <Navigate to="/" replace />;
  }

  if (profile.role !== 'admin') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <ShieldAlert className="h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-bold">אין הרשאת גישה</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          רק משתמשי <span className="font-semibold">מנהל מערכת</span> יכולים לגשת לדף הזה.
          התפקיד שלך כרגע: <span className="font-mono">{profile.role}</span>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
