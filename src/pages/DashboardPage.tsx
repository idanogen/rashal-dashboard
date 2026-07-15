import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDedupedOrders } from '@/hooks/useDedupedOrders';
import { useOrderStats } from '@/hooks/useOrderStats';
import { useZonedServiceCalls } from '@/hooks/useZonedServiceCalls';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { ReturnedFromRouteSection } from '@/components/dashboard/ReturnedFromRouteSection';
import { ReturnedServiceCallsSection } from '@/components/dashboard/ReturnedServiceCallsSection';
import { DedupToggle } from '@/components/dashboard/DedupToggle';
import { StaleOrdersAlert } from '@/components/dashboard/StaleOrdersAlert';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { ServiceCallStatsCards } from '@/components/dashboard/ServiceCallStatsCards';
import { DailyOrdersChart } from '@/components/dashboard/DailyOrdersChart';
import { HealthFundChart } from '@/components/dashboard/HealthFundChart';
import { DailyServiceCallsChart } from '@/components/dashboard/DailyServiceCallsChart';
import { ServiceCallHealthFundChart } from '@/components/dashboard/ServiceCallHealthFundChart';
import { ServiceCallsTable } from '@/components/dashboard/ServiceCallsTable';
import { ScheduledOverview } from '@/components/dashboard/ScheduledOverview';
import { OrderFilters, type OrderFiltersState } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Truck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardPage() {
  const {
    orders,
    groupSize: ordersGroupSize,
    hiddenCount: ordersHiddenCount,
    isLoading,
    error,
    refetch,
  } = useDedupedOrders();
  const stats = useOrderStats(orders);
  const {
    allCalls,
    pendingCalls,
    scheduledCalls,
    completedCalls,
    groupSize: callsGroupSize,
    hiddenCount: callsHiddenCount,
    isLoading: isLoadingCalls,
  } = useZonedServiceCalls();
  const { data: calendarStops = [] } = useCalendarStops();

  // הזמנות שחזרו מהקו — קיים stop "לא בוצע", וההזמנה עדיין ממתינה לתאום.
  const returnedOrders = useMemo(() => {
    const returnedIds = new Set(
      calendarStops
        .filter((s) => s.status === 'not_completed' && s.sourceType === 'delivery' && s.orderId)
        .map((s) => s.orderId as string)
    );
    return (orders ?? []).filter(
      (o) => returnedIds.has(o.id) && o.orderStatus === 'ממתין לתאום'
    );
  }, [calendarStops, orders]);

  // קריאות שירות שחזרו מהקו — קיים stop "לא בוצע", והקריאה חזרה ל"קריאה חדשה".
  const returnedCalls = useMemo(() => {
    const returnedIds = new Set(
      calendarStops
        .filter((s) => s.status === 'not_completed' && s.sourceType === 'service' && s.serviceCallId)
        .map((s) => s.serviceCallId as string)
    );
    return (allCalls ?? []).filter(
      (c) => returnedIds.has(c.id) && c.serviceCallStatus === 'קריאה חדשה'
    );
  }, [calendarStops, allCalls]);

  const [filters, setFilters] = useState<OrderFiltersState>({
    search: '',
    orderStatus: '',
    worker: '',
    city: '',
  });
  const tableRef = useRef<HTMLDivElement>(null);

  const handleShowStale = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          {error instanceof Error ? error.message : 'שגיאה לא ידועה'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          נסה שוב
        </Button>
      </div>
    );
  }

  const waitingCount = (orders ?? []).filter(
    (o) => o.orderStatus === 'ממתין לתאום'
  ).length;

  return (
    <div className="space-y-6">
      {/* Delivery Summary Card */}
      {waitingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">
                  {waitingCount} הזמנות ממתינות לתיאום משלוח
                </p>
                <p className="text-sm text-muted-foreground">
                  עבור לדף משלוחים כדי לסנן לפי אזור ולבנות מסלול
                </p>
              </div>
            </div>
            <Link to="/routes">
              <Button variant="default" className="gap-2">
                למשלוחים
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="orders" className="gap-1.5">
            <span>📦</span>
            הזמנות
          </TabsTrigger>
          <TabsTrigger value="service-calls" className="gap-1.5">
            <span>🔧</span>
            קריאות שירות
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-1.5">
            <span>📅</span>
            יומן מאוחד
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-6">
          <ReturnedFromRouteSection orders={returnedOrders} />
          <StaleOrdersAlert orders={orders ?? []} onShowStale={handleShowStale} />
          <StatsCards stats={stats} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DailyOrdersChart orders={orders ?? []} />
            <HealthFundChart orders={orders ?? []} />
          </div>
          <div ref={tableRef} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <OrderFilters
                filters={filters}
                onChange={setFilters}
                cities={stats.uniqueCities}
              />
              <DedupToggle hiddenCount={ordersHiddenCount} />
            </div>
            <OrdersTable orders={orders} filters={filters} groupSize={ordersGroupSize} />
          </div>
        </TabsContent>

        {/* Service Calls Tab */}
        <TabsContent value="service-calls" className="space-y-6">
          <ReturnedServiceCallsSection calls={returnedCalls} />
          <ServiceCallStatsCards
            pending={pendingCalls.length}
            scheduled={scheduledCalls.length}
            completed={completedCalls.length}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DailyServiceCallsChart calls={allCalls} />
            <ServiceCallHealthFundChart calls={allCalls} />
          </div>
          {isLoadingCalls ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <DedupToggle hiddenCount={callsHiddenCount} />
              </div>
              <ServiceCallsTable calls={allCalls} groupSize={callsGroupSize} />
            </div>
          )}
        </TabsContent>

        {/* Unified scheduled view — all types + all assignees, today onward */}
        <TabsContent value="scheduled" className="space-y-6">
          <ScheduledOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
