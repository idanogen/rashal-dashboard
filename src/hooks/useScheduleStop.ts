import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStop, deleteStop, geocodeStopAddress } from '@/lib/calendar-stops';
import { setSourceState } from '@/lib/stop-source-sync';
import type { ScheduleStopInput } from '@/types/calendar-stop';
import { useChatAuthor } from '@/hooks/useTimeline';
import { toast } from 'sonner';

/**
 * שיבוץ stop חדש ליומן + סנכרון סטטוס ב-source:
 * - delivery → orders.order_status = 'תואמה אספקה'
 * - service  → service_calls.service_call_status = 'תואם ביקור'
 * - pickup   → pickups.pickup_status = 'תואם איסוף'
 * - task     → אין source, רק stop
 */
export function useScheduleStop() {
  const queryClient = useQueryClient();
  const { userName } = useChatAuthor();

  return useMutation({
    mutationFn: async (input: ScheduleStopInput) => {
      const stop = await createStop({ scheduledBy: userName, ...input });

      // עדכון סטטוס המקור. אם הוא נכשל — מוחקים את העצירה שנוצרה, אחרת
      // נשארת עצירה יתומה שחוסמת כל ניסיון שיבוץ חוזר (chk הכפילויות).
      try {
        await setSourceState(input, 'scheduled');
      } catch (err) {
        try {
          await deleteStop(stop.id);
        } catch (rollbackErr) {
          console.error('[scheduleStop] rollback (deleteStop) failed:', rollbackErr);
        }
        throw err;
      }

      // geocoding מדויק לכתובת — fire-and-forget, לא חוסם את השיבוץ.
      // הקריאה מ-DB נופלת ל-fallback לפי עיר עד שזה מסתיים.
      void geocodeStopAddress(stop).then((ok) => {
        if (ok) queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      });

      return stop;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
    },
    onError: (err) => {
      console.error('[scheduleStop] Error:', err);
      toast.error('שגיאה בשיבוץ העצירה', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
