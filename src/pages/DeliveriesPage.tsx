import { useZonedOrders } from '@/hooks/useZonedOrders';
import { DeliveryStatusBar } from '@/components/deliveries/DeliveryStatusBar';
import { UnscheduledOrders } from '@/components/deliveries/UnscheduledOrders';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeliveriesPage() {
  const {
    unscheduledOrders,
    scheduledOrders,
    deliveredOrders,
    orderCountByZone,
    orderZoneMap,
    isLoading,
    error,
  } = useZonedOrders();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">טוען הזמנות...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">שגיאה בטעינת הנתונים</p>
        <p className="max-w-md text-center text-xs text-muted-foreground">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <DeliveryStatusBar
        waitingCount={unscheduledOrders.length}
        scheduledCount={scheduledOrders.length}
        deliveredThisWeek={deliveredOrders.length}
      />

      {/* Unscheduled Orders with Zone Filter */}
      <UnscheduledOrders
        orders={unscheduledOrders}
        orderCountByZone={orderCountByZone}
        orderZoneMap={orderZoneMap}
      />
    </div>
  );
}
