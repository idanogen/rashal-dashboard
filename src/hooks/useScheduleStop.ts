import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStop, geocodeStopAddress } from '@/lib/calendar-stops';
import { updateOrder } from '@/lib/orders';
import { updateServiceCall } from '@/lib/service-calls';
import { updatePickup } from '@/lib/pickups';
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

      if (input.sourceType === 'delivery' && input.orderId) {
        await updateOrder(input.orderId, { orderStatus: 'תואמה אספקה' });
      } else if (input.sourceType === 'service' && input.serviceCallId) {
        await updateServiceCall(input.serviceCallId, {
          serviceCallStatus: 'תואם ביקור',
        });
      } else if (input.sourceType === 'pickup' && input.pickupId) {
        await updatePickup(input.pickupId, { pickupStatus: 'תואם איסוף' });
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
