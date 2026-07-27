import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveStopToNewDay } from '@/lib/calendar-stops';
import { setSourceState } from '@/lib/stop-source-sync';
import type { CalendarStop } from '@/types/calendar-stop';
import { useChatAuthor } from '@/hooks/useTimeline';
import { toast } from 'sonner';

interface MoveStopParams {
  stop: CalendarStop;
  newDate: string;
  newDriver: CalendarStop['driver'];
}

/**
 * העברת עצירה שלא בוצעה ליום אחר:
 *  - העצירה חוזרת לסטטוס planned על היום/העובד החדשים
 *  - המקור מסונכרן חזרה ל"תואם" (יצא מהממתינים):
 *      delivery → 'תואמה אספקה' · service → 'תואם ביקור' · pickup → 'תואם איסוף'
 */
export function useMoveStop() {
  const queryClient = useQueryClient();
  const { userName } = useChatAuthor();

  return useMutation({
    mutationFn: async ({ stop, newDate, newDriver }: MoveStopParams) => {
      // מקדימים את עדכון המקור (הפיך) לפני הזזת העצירה. אם ההזזה נכשלת
      // (למשל חסם כפילות) — מחזירים את המקור לממתינים, כדי שלא יישאר
      // מקור "משובץ" בלי עצירה פעילה.
      await setSourceState(stop, 'scheduled');

      let moved;
      try {
        moved = await moveStopToNewDay(stop.id, {
          newDate,
          newDriver,
          movedBy: userName,
        });
      } catch (err) {
        try {
          await setSourceState(stop, 'waiting');
        } catch (rollbackErr) {
          console.error('[moveStop] rollback (restore source) failed:', rollbackErr);
        }
        throw err;
      }

      return moved;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      const he = new Date(variables.newDate + 'T00:00:00').toLocaleDateString(
        'he-IL',
        { day: 'numeric', month: 'numeric' }
      );
      toast.success(`הועבר ל-${he} · ${variables.newDriver}`);
    },
    onError: (err) => {
      console.error('[moveStop] Error:', err);
      const msg = err instanceof Error ? err.message : '';
      // חסם הכפילויות ב-DB — כבר קיים שיבוץ פעיל לאותו לקוח.
      if (msg.includes('calendar_stops_no_active_dup') || msg.includes('duplicate key')) {
        toast.error('ההעברה נחסמה: הלקוח כבר משובץ פעיל ביומן');
      } else {
        toast.error('שגיאה בהעברת העצירה', { description: msg || undefined });
      }
    },
  });
}
