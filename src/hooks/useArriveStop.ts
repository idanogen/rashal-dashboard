import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStop } from '@/lib/calendar-stops';
import { toast } from 'sonner';

/**
 * סימון "הגעה" לעצירה — מעביר את ה-stop לסטטוס `in_progress`.
 * לא נוגע בסטטוס המקור (order/service) — זו רק חיווי שהנהג בנקודה.
 */
export function useArriveStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stopId: string) => updateStop(stopId, { status: 'in_progress' }),
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
