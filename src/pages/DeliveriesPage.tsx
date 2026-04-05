import { useState, useCallback, useMemo } from 'react';
import { useZonedOrders } from '@/hooks/useZonedOrders';
import { useRoutes } from '@/hooks/useRoutes';
import { useUpdateOrder } from '@/hooks/useUpdateOrder';
import { useUpdateRoute } from '@/hooks/useUpdateRoute';
import { DeliveryStatusBar } from '@/components/deliveries/DeliveryStatusBar';
import { UnscheduledOrders } from '@/components/deliveries/UnscheduledOrders';
import { ApprovedRoutesList } from '@/components/deliveries/ApprovedRoutesList';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { RouteBuilderDialog } from '@/components/deliveries/RouteBuilderDialog';
import { DatePickerDialog } from '@/components/deliveries/DatePickerDialog';
import { DayMapDialog } from '@/components/deliveries/DayMapDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Package, Truck } from 'lucide-react';
import type { Order } from '@/types/order';
import type { ApprovedRoute } from '@/types/route';
import type { CalendarDelivery, CalendarStop } from '@/types/delivery';
import { toast } from 'sonner';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  closestCenter,
} from '@dnd-kit/core';

const screenReaderInstructions = { draggable: '' };
const announcements: Announcements = {
  onDragStart: () => '',
  onDragOver: () => '',
  onDragEnd: () => '',
  onDragCancel: () => '',
};

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
  const updateOrder = useUpdateOrder();
  const updateRoute = useUpdateRoute();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // State
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  );
  const [routeBuilderOpen, setRouteBuilderOpen] = useState(false);
  const [routeBuilderOrders, setRouteBuilderOrders] = useState<Order[]>([]);
  const [routeBuilderDate, setRouteBuilderDate] = useState<string | undefined>(
    undefined
  );
  const [editRoute, setEditRoute] = useState<ApprovedRoute | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dayMapOpen, setDayMapOpen] = useState(false);
  const [dayMapDate, setDayMapDate] = useState<string | null>(null);
  const [dayMapRoutes, setDayMapRoutes] = useState<ApprovedRoute[]>([]);

  // Calendar deliveries from approved routes
  const calendarDeliveries: CalendarDelivery[] = useMemo(
    () =>
      routes
        .filter((r) => r.status === 'מאושר' || r.status === 'בביצוע')
        .map((route) => ({
          id: route.id,
          date: route.deliveryDate,
          driver: route.driver,
          stops: route.stops.map(
            (stop): CalendarStop => ({
              orderId: stop.id,
              customerName: stop.customerName,
              address: stop.address,
              city: stop.city,
              phone: stop.phone,
            })
          ),
        })),
    [routes]
  );

  const activeRoutesCount = routes.filter(
    (r) => r.status === 'מאושר' || r.status === 'בביצוע'
  ).length;

  // ─── Selection ──────────────────────────────────────────
  const handleToggleSelect = useCallback((orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
  }, []);

  // ─── Bulk schedule (click-to-schedule flow) ────────────
  const handleBulkSchedule = useCallback(() => {
    if (selectedOrderIds.size === 0) return;
    setDatePickerOpen(true);
  }, [selectedOrderIds]);

  const handleDateSelected = useCallback(
    (date: string) => {
      const ordersForRoute = unscheduledOrders.filter((o) =>
        selectedOrderIds.has(o.id)
      );
      if (ordersForRoute.length === 0) {
        setDatePickerOpen(false);
        return;
      }
      setRouteBuilderOrders(ordersForRoute);
      setRouteBuilderDate(date);
      setRouteBuilderOpen(true);
      setDatePickerOpen(false);
      setSelectedOrderIds(new Set());
    },
    [selectedOrderIds, unscheduledOrders]
  );

  // ─── Drag → immediately open RouteBuilder ───────────────
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'order') {
      setDraggedOrder(active.data.current.order as Order);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedOrder(null);

    if (!over) return;

    if (
      active.data.current?.type === 'order' &&
      over.data.current?.type === 'day'
    ) {
      const order = active.data.current.order as Order;
      const date = over.data.current.date as string;

      // Block Friday/Saturday
      const targetDay = new Date(date + 'T00:00:00').getDay();
      if (targetDay === 5 || targetDay === 6) {
        toast.error('לא ניתן לתזמן ליום שישי או שבת');
        return;
      }

      // Collect orders: if part of selection, take all selected
      let ordersForRoute: Order[];
      if (selectedOrderIds.has(order.id) && selectedOrderIds.size > 1) {
        ordersForRoute = unscheduledOrders.filter((o) =>
          selectedOrderIds.has(o.id)
        );
      } else {
        ordersForRoute = [order];
      }

      // Open RouteBuilderDialog immediately with the dropped date
      setRouteBuilderOrders(ordersForRoute);
      setRouteBuilderDate(date);
      setRouteBuilderOpen(true);
      setSelectedOrderIds(new Set());
    }
  };

  // ─── View day on map (preview before editing) ──────────
  const handleViewDayRoute = useCallback(
    (dateStr: string) => {
      const dayRoutes = routes.filter(
        (r) =>
          r.deliveryDate === dateStr &&
          (r.status === 'מאושר' || r.status === 'בביצוע')
      );

      if (dayRoutes.length === 0) return;

      setDayMapDate(dateStr);
      setDayMapRoutes(dayRoutes);
      setDayMapOpen(true);
    },
    [routes]
  );

  const openRouteForEdit = useCallback((route: ApprovedRoute) => {
    setEditRoute(route);
    setRouteBuilderOrders([]);
    setRouteBuilderDate(undefined);
    setRouteBuilderOpen(true);
    setDayMapOpen(false);
  }, []);

  // ─── Remove order from calendar (approved route) ────────
  const handleRemoveFromCalendar = async (
    deliveryId: string,
    orderId: string
  ) => {
    const route = routes.find((r) => r.id === deliveryId);
    if (!route) return;

    try {
      await updateOrder.mutateAsync({
        id: orderId,
        fields: { orderStatus: 'ממתין לתאום' },
      });

      const newStops = route.stops.filter((s) => s.id !== orderId);
      const newOrderIds = route.orderIds.filter((id) => id !== orderId);

      if (newStops.length === 0) {
        await updateRoute.mutateAsync({
          id: deliveryId,
          fields: { status: 'בוטל' },
        });
      } else {
        await updateRoute.mutateAsync({
          id: deliveryId,
          fields: {
            stops: newStops,
            orderIds: newOrderIds,
            stopCount: newStops.length,
          },
        });
      }

      toast.success('ההזמנה הוחזרה לממתינות');
    } catch (err) {
      console.error('Failed to remove from calendar:', err);
      toast.error('שגיאה בהסרת ההזמנה');
    }
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
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <div className="space-y-6">
        <DeliveryStatusBar
          waitingCount={unscheduledOrders.length}
          scheduledCount={scheduledOrders.length}
          deliveredThisWeek={deliveredOrders.length}
        />

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
                <Badge
                  variant="secondary"
                  className="mr-1 h-5 px-1.5 text-xs"
                >
                  {activeRoutesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unscheduled" className="space-y-6">
            <UnscheduledOrders
              orders={unscheduledOrders}
              orderCountByZone={orderCountByZone}
              orderZoneMap={orderZoneMap}
              selectedOrderIds={selectedOrderIds}
              onToggleSelect={handleToggleSelect}
              onClearSelection={handleClearSelection}
              onBulkSchedule={handleBulkSchedule}
              isDragging={!!draggedOrder}
            />

            <DeliveryCalendar
              deliveries={calendarDeliveries}
              onRemoveOrder={handleRemoveFromCalendar}
              onViewDayRoute={handleViewDayRoute}
            />
          </TabsContent>

          <TabsContent value="approved">
            <ApprovedRoutesList routes={routes} isLoading={routesLoading} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedOrder && (
          <div className="w-56 rounded-xl border bg-card p-3 shadow-lg">
            <div className="text-sm font-bold">
              {draggedOrder.customerName}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {draggedOrder.address}
              {draggedOrder.city ? `, ${draggedOrder.city}` : ''}
            </div>
            {selectedOrderIds.has(draggedOrder.id) &&
              selectedOrderIds.size > 1 && (
                <div className="absolute -top-2.5 -start-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-md ring-2 ring-background">
                  {selectedOrderIds.size}
                </div>
              )}
          </div>
        )}
      </DragOverlay>

      {/* Date Picker — bulk schedule via click */}
      <DatePickerDialog
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onDateSelected={handleDateSelected}
        orderCount={selectedOrderIds.size}
      />

      {/* Day Map — preview of all routes for a specific day */}
      <DayMapDialog
        open={dayMapOpen}
        onClose={() => setDayMapOpen(false)}
        date={dayMapDate}
        routes={dayMapRoutes}
        onEditRoute={openRouteForEdit}
      />

      {/* Route Builder — opens after drag to day OR after date picker */}
      <RouteBuilderDialog
        open={routeBuilderOpen}
        onOpenChange={(open) => {
          setRouteBuilderOpen(open);
          if (!open) {
            setEditRoute(undefined);
            setRouteBuilderDate(undefined);
          }
        }}
        orders={routeBuilderOrders}
        editRoute={editRoute}
        initialDate={routeBuilderDate}
      />
    </DndContext>
  );
}
