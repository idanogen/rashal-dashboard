import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentProfile } from '@/hooks/useProfile';
import { Loader2, ShieldAlert } from 'lucide-react';
import { ROLE_LABELS, type UserRole } from '@/types/profile';

/**
 * שער לדפי הניהול. ברירת המחדל היא מנהל מערכת בלבד, ומסך שמותר גם
 * ל"מנהל צוות" מעביר `allow` מפורש. 🔴 ההרשאה נאכפת גם בשרת
 * (`api/admin-users.ts`) וגם ב-RLS; זה השער הוויזואלי בלבד.
 */
export function ProtectedAdminRoute({
  children,
  allow = ['admin'],
}: {
  children: ReactNode;
  allow?: UserRole[];
}) {
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

  if (!allow.includes(profile.role)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <ShieldAlert className="h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-bold">אין הרשאת גישה</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          הדף הזה פתוח ל: <span className="font-semibold">{allow.map((r) => ROLE_LABELS[r]).join(' · ')}</span>.
          התפקיד שלך כרגע: <span className="font-semibold">{ROLE_LABELS[profile.role] ?? profile.role}</span>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
