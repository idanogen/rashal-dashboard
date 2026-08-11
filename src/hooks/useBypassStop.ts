import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStop } from '@/lib/calendar-stops';
import { sendDriverAlert } from '@/lib/driver-alerts';
import type { CalendarStop } from '@/types/calendar-stop';
import { toast } from 'sonner';

interface BypassInput {
  /** העצירה שהנהג עובר אליה. */
  target: CalendarStop;
  /** העצירות שנעקפו בדרך, לפי הסדר. */
  bypassed: CalendarStop[];
  reason: string;
  driverName: string;
  total: number;
}

/**
 * מעבר לעצירה מחוץ לסדר.
 *
 * שתי פעולות נפרדות בכוונה:
 *   1. רישום החריגה על **העצירות שנעקפו** — הן אלה שהלקוח שלהן ממתין.
 *   2. התראה לעמי על כל אחת מהן.
 *
 * ההתראה לא חוסמת: אם הוואטסאפ נכשל (למשל חלון 24 השעות סגור ואין עדיין
 * תבנית מאושרת), החריגה כבר רשומה במסד והסדרן יראה אותה בדוח. עדיף לאבד
 * הודעה מאשר לתקוע נהג באמצע יום עבודה.
 */
export function useBypassStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bypassed, reason, driverName, total }: BypassInput) => {
      const now = new Date().toISOString();

      await Promise.all(
        bypassed.map((stop) =>
          updateStop(stop.id, {
            bypassedAt: now,
            bypassReason: reason,
            bypassedBy: driverName,
          }),
        ),
      );

      const alerts = await Promise.all(
        bypassed.map((stop, i) =>
          sendDriverAlert({
            kind: 'bypass',
            stop,
            driverName,
            reason,
            position: { index: stop.sequence || i + 1, total },
          }),
        ),
      );

      const flat = alerts.flat();
      return {
        count: bypassed.length,
        alertsSent: flat.filter((a) => a.sent).length,
        isDemo: flat.some((a) => a.isDemo),
      };
    },

    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      const noun = result.count === 1 ? 'עצירה' : 'עצירות';
      if (result.alertsSent > 0 && !result.isDemo) {
        toast.warning(`דילגת על ${result.count} ${noun}`, { description: 'נשלחה הודעה לעמי' });
      } else if (result.isDemo) {
        toast.warning(`דילגת על ${result.count} ${noun}`, {
          description: 'ההודעה נרשמה במצב הדגמה ולא נשלחה בפועל',
        });
      } else {
        toast.warning(`דילגת על ${result.count} ${noun}`, {
          description: 'החריגה נרשמה. שליחת ההודעה נכשלה.',
        });
      }
    },

    onError: (err) => {
      console.error('[bypassStop] Error:', err);
      toast.error('לא הצלחנו לרשום את הדילוג', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
