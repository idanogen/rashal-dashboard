import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStop } from '@/lib/calendar-stops';
import { toast } from 'sonner';

export interface ArriveInput {
  stopId: string;
  coordinates?: { lat: number; lng: number } | null;
}

/**
 * סימון "הגעה" לעצירה — מעביר את ה-stop לסטטוס `in_progress`.
 * לא נוגע בסטטוס המקור (order/service) — זו רק חיווי שהנהג בנקודה.
 *
 * מאז 11/08 נשמרים גם הרגע והמיקום. המיקום נתפס פעם אחת בלבד, ברגע ההגעה,
 * ולא כמעקב רציף: זה כמעט חינם, זה עונה על השאלה "הנהג באמת היה שם", וזה
 * לא הופך את האפליקציה לכלי מעקב אחרי עובד.
 */
export function useArriveStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stopId, coordinates }: ArriveInput) =>
      updateStop(stopId, {
        status: 'in_progress',
        arrivedAt: new Date().toISOString(),
        ...(coordinates ? { arrivedCoordinates: coordinates } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
    },
    onError: (err) => {
      console.error('[arriveStop] Error:', err);
      toast.error('שגיאה בסימון הגעה', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
