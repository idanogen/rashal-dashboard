import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRoute } from '@/lib/airtable-routes';
import { updateMultipleServiceCalls } from '@/lib/airtable-service-calls';
import type { ServiceCall } from '@/types/service-call';
import type { DriverName, RouteStop } from '@/types/route';
import { toast } from 'sonner';

interface ApproveServiceRouteParams {
  calls: ServiceCall[];
  driver: DriverName;
  deliveryDate: string;
  totalDistance: number;
  estimatedTime: number;
}

export function useApproveServiceRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ApproveServiceRouteParams) => {
      const { calls, driver, deliveryDate, totalDistance, estimatedTime } = params;

      const stops: RouteStop[] = calls.map((c, idx) => ({
        id: c.id,
        customerName: c.customerName,
        city: c.city,
        phone: c.phone,
        sequence: idx + 1,
      }));

      const dateLabel = new Date(deliveryDate).toLocaleDateString('he-IL');
      const routeName = `שירות ${dateLabel} - ${driver}`;

      const route = await createRoute({
        routeName,
        driver,
        deliveryDate,
        status: 'מאושר',
        orderIds: calls.map((c) => c.id),
        stops,
        stopCount: calls.length,
        estimatedDistance: totalDistance,
        estimatedTime,
      });

      const callUpdates = calls.map((c) => ({
        id: c.id,
        fields: { serviceCallStatus: 'תואם ביקור' as const },
      }));
      await updateMultipleServiceCalls(callUpdates);

      return route;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      toast.success('מסלול השירות אושר בהצלחה!');
    },

    onError: (err) => {
      console.error('[approveServiceRoute] Error:', err);
      toast.error('שגיאה באישור מסלול השירות', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
