import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStop } from '@/lib/calendar-stops';
import { updateOrder } from '@/lib/orders';
import { updateServiceCall } from '@/lib/service-calls';
import type { ScheduleStopInput } from '@/types/calendar-stop';
import { toast } from 'sonner';

/**
 * שיבוץ stop חדש ליומן + סנכרון סטטוס ב-source:
 * - delivery → orders.order_status = 'תואמה אספקה'
 * - service  → service_calls.service_call_status = 'תואם ביקור'
 * - task     → אין source, רק stop
 */
export function useScheduleStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ScheduleStopInput) => {
      const stop = await createStop(input);

      if (input.sourceType === 'delivery' && input.orderId) {
        await updateOrder(input.orderId, { orderStatus: 'תואמה אספקה' });
      } else if (input.sourceType === 'service' && input.serviceCallId) {
        await updateServiceCall(input.serviceCallId, {
          serviceCallStatus: 'תואם ביקור',
        });
      }

      return stop;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
    },
    onError: (err) => {
      console.error('[scheduleStop] Error:', err);
      toast.error('שגיאה בשיבוץ העצירה', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
