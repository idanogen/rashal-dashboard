import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveStop } from '@/lib/calendar-stops';
import { updateOrder } from '@/lib/orders';
import { updateServiceCall } from '@/lib/service-calls';
import { updatePickup } from '@/lib/pickups';
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
      const updated = await resolveStop(stop.id, status, notes);

      if (status === 'completed') {
        if (stop.sourceType === 'delivery' && stop.orderId) {
          await updateOrder(stop.orderId, { orderStatus: 'סופק' });
        } else if (stop.sourceType === 'service' && stop.serviceCallId) {
          await updateServiceCall(stop.serviceCallId, {
            serviceCallStatus: 'בוצע',
          });
        } else if (stop.sourceType === 'pickup' && stop.pickupId) {
          await updatePickup(stop.pickupId, { pickupStatus: 'נאסף' });
        }
      } else {
        // not_completed — חזרה לממתינים
        if (stop.sourceType === 'delivery' && stop.orderId) {
          await updateOrder(stop.orderId, { orderStatus: 'ממתין לתאום' });
        } else if (stop.sourceType === 'service' && stop.serviceCallId) {
          await updateServiceCall(stop.serviceCallId, {
            serviceCallStatus: 'קריאה חדשה',
          });
        } else if (stop.sourceType === 'pickup' && stop.pickupId) {
          await updatePickup(stop.pickupId, { pickupStatus: 'ממתין לתאום' });
        }
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
