import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteStop } from '@/lib/calendar-stops';
import { setSourceState } from '@/lib/stop-source-sync';
import type { CalendarStop } from '@/types/calendar-stop';
import { toast } from 'sonner';

/**
 * מחיקת stop מהיומן + החזרת ה-source למצב ממתינים:
 *  delivery → orders.order_status = 'ממתין לתאום'
 *  service  → service_calls.service_call_status = 'קריאה חדשה'
 *  task     → מחיקה בלבד (אין source)
 */
export function useDeleteStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stop: CalendarStop) => {
      // מקדימים את עדכון המקור (הפיך) לפני המחיקה (הרסנית). אם המחיקה
      // נכשלת — מחזירים את המקור למצב המשובץ, כדי שלא יישאר מקור בממתינים
      // עם עצירה פעילה (מצב שחוסם שיבוץ חוזר).
      await setSourceState(stop, 'waiting');

      try {
        await deleteStop(stop.id);
      } catch (err) {
        try {
          await setSourceState(stop, 'scheduled');
        } catch (rollbackErr) {
          console.error('[deleteStop] rollback (restore source) failed:', rollbackErr);
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      toast.success('העצירה הוסרה מהיומן');
    },
    onError: (err) => {
      console.error('[deleteStop] Error:', err);
      toast.error('שגיאה בהסרת העצירה');
    },
  });
}
