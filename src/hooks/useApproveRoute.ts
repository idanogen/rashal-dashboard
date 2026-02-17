import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRoute } from '@/lib/airtable-routes';
import { updateMultipleOrders } from '@/lib/airtable';
import type { Order } from '@/types/order';
import type { DriverName, RouteStop } from '@/types/route';
import { toast } from 'sonner';

interface ApproveRouteParams {
  orders: Order[];
  driver: DriverName;
  deliveryDate: string;
  totalDistance: number;
  estimatedTime: number;
}

export function useApproveRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ApproveRouteParams) => {
      const { orders, driver, deliveryDate, totalDistance, estimatedTime } = params;

      // בניית פרטי עצירות
      const stops: RouteStop[] = orders.map((o, idx) => ({
        id: o.id,
        customerName: o.customerName,
        address: o.address,
        city: o.city,
        phone: o.phone,
        sequence: idx + 1,
      }));

      const dateLabel = new Date(deliveryDate).toLocaleDateString('he-IL');
      const routeName = `מסלול ${dateLabel} - ${driver}`;

      // 1. שמירת מסלול באיירטייבל
      const route = await createRoute({
        routeName,
        driver,
        deliveryDate,
        status: 'מאושר',
        orderIds: orders.map((o) => o.id),
        stops,
        stopCount: orders.length,
        estimatedDistance: totalDistance,
        estimatedTime,
      });

      // 2. עדכון סטטוס כל ההזמנות ל"תואמה אספקה"
      const orderUpdates = orders.map((o) => ({
        id: o.id,
        fields: { orderStatus: 'תואמה אספקה ' as const },
      }));
      await updateMultipleOrders(orderUpdates);

      return route;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('המסלול אושר בהצלחה!');
    },

    onError: (err) => {
      console.error('[approveRoute] Error:', err);
      toast.error('שגיאה באישור המסלול', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
