import { useZonedOrders } from '@/hooks/useZonedOrders';
import { useRoutes } from '@/hooks/useRoutes';
import { DeliveryStatusBar } from '@/components/deliveries/DeliveryStatusBar';
import { UnscheduledOrders } from '@/components/deliveries/UnscheduledOrders';
import { ApprovedRoutesList } from '@/components/deliveries/ApprovedRoutesList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Package, Truck } from 'lucide-react';

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

  const { data: routes = [], isLoading: routesLoading } = useRoutes();

  const activeRoutesCount = routes.filter(
    (r) => r.status === 'מאושר' || r.status === 'בביצוע'
  ).length;

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

      {/* Tabs */}
      <Tabs defaultValue="unscheduled" dir="rtl">
        <TabsList>
          <TabsTrigger value="unscheduled" className="gap-1.5">
            <Package className="h-4 w-4" />
            הזמנות ממתינות
            <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
              {unscheduledOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            <Truck className="h-4 w-4" />
            מסלולים מאושרים
            {activeRoutesCount > 0 && (
              <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                {activeRoutesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unscheduled">
          <UnscheduledOrders
            orders={unscheduledOrders}
            orderCountByZone={orderCountByZone}
            orderZoneMap={orderZoneMap}
          />
        </TabsContent>

        <TabsContent value="approved">
          <ApprovedRoutesList routes={routes} isLoading={routesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
