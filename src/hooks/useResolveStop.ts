import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveStop } from '@/lib/calendar-stops';
import { setSourceState } from '@/lib/stop-source-sync';
import type { CalendarStop } from '@/types/calendar-stop';
import { toast } from 'sonner';

interface ResolveStopParams {
  stop: CalendarStop;
  status: 'completed' | 'not_completed';
  notes?: string;
}

/**
 * סימון stop כבוצע/לא בוצע + סנכרון המקור:
 *  completed:
 *    - delivery → orders.order_status = 'סופק'
 *    - service  → service_calls.service_call_status = 'בוצע'
 *  not_completed:
 *    - delivery → orders.order_status = 'ממתין לתאום' (חוזר לממתינים)
 *    - service  → service_calls.service_call_status = 'קריאה חדשה'
 */
export function useResolveStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stop, status, notes }: ResolveStopParams) => {
      // מקדימים את עדכון המקור (הפיך) לפני עדכון העצירה. אם עדכון העצירה
      // נכשל — מחזירים את המקור למצב המשובץ, כדי שלא ייווצר פער בין
      // סטטוס העצירה לסטטוס המקור.
      await setSourceState(stop, status === 'completed' ? 'done' : 'waiting');

      let updated;
      try {
        updated = await resolveStop(stop.id, status, notes);
      } catch (err) {
        try {
          await setSourceState(stop, 'scheduled');
        } catch (rollbackErr) {
          console.error('[resolveStop] rollback (restore source) failed:', rollbackErr);
        }
        throw err;
      }

      return updated;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      toast.success(
        variables.status === 'completed' ? 'סומן כבוצע' : 'סומן כלא בוצע'
      );
    },
    onError: (err) => {
      console.error('[resolveStop] Error:', err);
      toast.error('שגיאה בעדכון העצירה', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
