import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteStop } from '@/lib/calendar-stops';
import { updateOrder } from '@/lib/orders';
import { updateServiceCall } from '@/lib/service-calls';
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
      await deleteStop(stop.id);

      if (stop.sourceType === 'delivery' && stop.orderId) {
        await updateOrder(stop.orderId, { orderStatus: 'ממתין לתאום' });
      } else if (stop.sourceType === 'service' && stop.serviceCallId) {
        await updateServiceCall(stop.serviceCallId, {
          serviceCallStatus: 'קריאה חדשה',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      toast.success('העצירה הוסרה מהיומן');
    },
    onError: (err) => {
      console.error('[deleteStop] Error:', err);
      toast.error('שגיאה בהסרת העצירה');
    },
  });
}
