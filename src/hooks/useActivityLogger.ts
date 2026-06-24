import { useCallback } from 'react';
import { useCurrentProfile } from './useProfile';
import { logActivity, type ActivityInput } from '@/lib/activity';

type LogOptions = Omit<ActivityInput, 'action' | 'actorId' | 'actorName' | 'actorRole'>;

/**
 * מחזיר פונקציית `log(action, opts?)` שממלאת אוטומטית את זהות השחקן
 * (נהג/מוקד) מהפרופיל המחובר ושולחת ללוג הפעולות. fire-and-forget.
 *
 *   const log = useActivityLogger();
 *   log('stop_completed', { entityType: 'calendar_stop', entityId: stop.id });
 */
export function useActivityLogger() {
  const { data: profile } = useCurrentProfile();

  return useCallback(
    (action: ActivityInput['action'], opts: LogOptions = {}) => {
      void logActivity({
        action,
        actorId: profile?.id,
        actorName: profile?.linkedDriver ?? profile?.fullName ?? profile?.username,
        actorRole: profile?.role,
        ...opts,
      });
    },
    [profile]
  );
}
