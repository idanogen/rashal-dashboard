import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCurrentProfile } from '@/hooks/useProfile';
import type { UserRole } from '@/types/profile';

interface RoleBasedRouteProps {
  children: ReactNode;
  /** Allowed roles. If the user's role is not in this list, they are redirected. */
  allow: UserRole[];
  /** Where to send users who don't have an allowed role. Defaults to '/driver' for drivers, '/' otherwise. */
  redirectTo?: string;
}

/**
 * Gate a route by user role. Used to:
 *   - Keep drivers out of admin/dispatcher pages (/, /routes, /service-calls, ...)
 *   - Keep non-admins out of /admin/users (handled separately by ProtectedAdminRoute)
 *
 * Always checks profile, never trusts the auth user alone.
 */
export function RoleBasedRoute({ children, allow, redirectTo }: RoleBasedRouteProps) {
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile || profile.disabled) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(profile.role)) {
    const fallback = redirectTo ?? (profile.role === 'driver' ? '/driver' : '/');
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

/** Convenience: send drivers to /driver, everyone else stays where they are. */
export function RedirectDriversHome({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useCurrentProfile();
  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (profile?.role === 'driver') {
    return <Navigate to="/driver" replace />;
  }
  return <>{children}</>;
}
