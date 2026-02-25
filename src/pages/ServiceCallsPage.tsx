import { useZonedServiceCalls } from '@/hooks/useZonedServiceCalls';
import { useRoutes } from '@/hooks/useRoutes';
import { ServiceCallStatusBar } from '@/components/service-calls/ServiceCallStatusBar';
import { UnscheduledServiceCalls } from '@/components/service-calls/UnscheduledServiceCalls';
import { ApprovedRoutesList } from '@/components/deliveries/ApprovedRoutesList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Wrench, Truck } from 'lucide-react';

export function ServiceCallsPage() {
  const {
    pendingCalls,
    scheduledCalls,
    completedCalls,
    callCountByZone,
    callZoneMap,
    isLoading,
    error,
  } = useZonedServiceCalls();

  const { data: routes = [], isLoading: routesLoading } = useRoutes();

  // Filter routes for service calls only (prefix "שירות")
  const serviceRoutes = routes.filter((r) => r.routeName.startsWith('שירות'));
  const activeServiceRoutesCount = serviceRoutes.filter(
    (r) => r.status === 'מאושר' || r.status === 'בביצוע'
  ).length;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">טוען קריאות שירות...</p>
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
      <ServiceCallStatusBar
        pendingCount={pendingCalls.length}
        scheduledCount={scheduledCalls.length}
        completedCount={completedCalls.length}
      />

      {/* Tabs */}
      <Tabs defaultValue="pending" dir="rtl">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Wrench className="h-4 w-4" />
            קריאות ממתינות
            <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
              {pendingCalls.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="service-routes" className="gap-1.5">
            <Truck className="h-4 w-4" />
            מסלולי שירות
            {activeServiceRoutesCount > 0 && (
              <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                {activeServiceRoutesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <UnscheduledServiceCalls
            calls={pendingCalls}
            callCountByZone={callCountByZone}
            callZoneMap={callZoneMap}
          />
        </TabsContent>

        <TabsContent value="service-routes">
          <ApprovedRoutesList routes={serviceRoutes} isLoading={routesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
