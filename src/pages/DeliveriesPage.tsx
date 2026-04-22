import { useState, useCallback, useMemo } from 'react';
import { useZonedOrders } from '@/hooks/useZonedOrders';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useScheduleStop } from '@/hooks/useScheduleStop';
import { useDeleteStop } from '@/hooks/useDeleteStop';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useReorderStops } from '@/hooks/useReorderStops';
import { DeliveryStatusBar } from '@/components/deliveries/DeliveryStatusBar';
import { UnscheduledOrders } from '@/components/deliveries/UnscheduledOrders';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { DriverSelector } from '@/components/deliveries/DriverSelector';
import { DatePickerDialog } from '@/components/deliveries/DatePickerDialog';
import { TaskDialog } from '@/components/deliveries/TaskDialog';
import { DayMapDialog } from '@/components/deliveries/DayMapDialog';
import { Loader2, AlertCircle } from 'lucide-react';
import type { Order } from '@/types/order';
import type { DriverName } from '@/types/route';
import type { CalendarDelivery } from '@/types/delivery';
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

  const { data: calendarStops = [] } = useCalendarStops();
  const scheduleStop = useScheduleStop();
  const deleteStop = useDeleteStop();
  const resolveStop = useResolveStop();
  const reorderStops = useReorderStops();

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Quick-schedule flow: drag → DriverSelector → useScheduleStop
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{
    orders: Order[];
    date: string;
  } | null>(null);

  // Task flow: "+" on day header → TaskDialog → useScheduleStop (sourceType='task')
  const [taskDialogDate, setTaskDialogDate] = useState<string | null>(null);

  // Day map dialog — click "מפה" on day header
  const [mapDialogDate, setMapDialogDate] = useState<string | null>(null);

  // Calendar deliveries — מקובצים מ-calendar_stops (מקור האמת החדש).
  // מציג את כל הסוגים (משלוחים + שירות + משימות).
  const calendarDeliveries: CalendarDelivery[] = useMemo(() => {
    const groups = new Map<string, CalendarDelivery>();
    for (const s of calendarStops) {
      if (s.status === 'cancelled') continue;
      const key = `${s.deliveryDate}__${s.driver}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          id: key,
          date: s.deliveryDate,
          driver: s.driver as DriverName,
          stops: [],
        };
        groups.set(key, group);
      }
      group.stops.push({
        stopId: s.id,
        sourceId: s.orderId ?? s.serviceCallId ?? s.id,
        sourceType: s.sourceType,
        status: s.status,
        deliveryDate: s.deliveryDate,
        driver: s.driver as DriverName,
        customerName: s.customerName,
        address: s.address,
        city: s.city,
        phone: s.phone,
      });
    }
    return Array.from(groups.values());
  }, [calendarStops]);

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
      const ordersForSchedule = unscheduledOrders.filter((o) =>
        selectedOrderIds.has(o.id)
      );
      if (ordersForSchedule.length === 0) {
        setDatePickerOpen(false);
        return;
      }
      // Quick flow: open DriverSelector instead of RouteBuilder
      setPendingSchedule({ orders: ordersForSchedule, date });
      setDriverPickerOpen(true);
      setDatePickerOpen(false);
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

    // ─── Reorder: stop → stop (באותו יום × נהג) ───
    if (
      active.data.current?.type === 'stop' &&
      over.data.current?.type === 'stop' &&
      active.id !== over.id
    ) {
      const srcDate = active.data.current.deliveryDate as string;
      const srcDriver = active.data.current.driver as DriverName;
      const overDate = over.data.current.deliveryDate as string;
      const overDriver = over.data.current.driver as DriverName;
      if (srcDate !== overDate || srcDriver !== overDriver) return;

      const groupStops = calendarStops
        .filter(
          (s) =>
            s.deliveryDate === srcDate &&
            s.driver === srcDriver &&
            s.status !== 'cancelled'
        )
        .sort((a, b) => a.sequence - b.sequence)
        .map((s) => s.id);
      const oldIndex = groupStops.indexOf(active.id as string);
      const newIndex = groupStops.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;

      // arrayMove
      const next = [...groupStops];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);

      reorderStops.mutate({
        deliveryDate: srcDate,
        driver: srcDriver,
        orderedIds: next,
      });
      return;
    }

    // ─── Schedule: order → day (may land on an existing stop inside the day) ───
    if (active.data.current?.type === 'order') {
      const over_t = over.data.current?.type;
      // Extract the target date whether we dropped on the day background or on a stop
      let date: string | undefined;
      if (over_t === 'day') {
        date = over.data.current?.date as string;
      } else if (over_t === 'stop') {
        date = over.data.current?.deliveryDate as string;
      }
      if (!date) return;

      const order = active.data.current.order as Order;

      // Block Friday/Saturday
      const targetDay = new Date(date + 'T00:00:00').getDay();
      if (targetDay === 5 || targetDay === 6) {
        toast.error('לא ניתן לתזמן ליום שישי או שבת');
        return;
      }

      // Collect orders: if part of selection, take all selected
      let ordersForSchedule: Order[];
      if (selectedOrderIds.has(order.id) && selectedOrderIds.size > 1) {
        ordersForSchedule = unscheduledOrders.filter((o) =>
          selectedOrderIds.has(o.id)
        );
      } else {
        ordersForSchedule = [order];
      }

      // Quick flow: DriverSelector instead of RouteBuilder
      setPendingSchedule({ orders: ordersForSchedule, date });
      setDriverPickerOpen(true);
    }
  };

  // Driver selected → create one calendar_stop per order + update order_status
  const handleDriverSelected = useCallback(
    async (driver: DriverName) => {
      if (!pendingSchedule) return;
      const { orders, date } = pendingSchedule;
      setDriverPickerOpen(false);

      try {
        for (const order of orders) {
          await scheduleStop.mutateAsync({
            deliveryDate: date,
            driver,
            sourceType: 'delivery',
            orderId: order.id,
            customerName: order.customerName,
            address: order.address,
            city: order.city,
            phone: order.phone,
          });
        }
        toast.success(
          orders.length > 1
            ? `שובצו ${orders.length} הזמנות ל${driver}`
            : `ההזמנה שובצה ל${driver}`
        );
      } catch (err) {
        console.error('schedule failed:', err);
      } finally {
        setPendingSchedule(null);
        setSelectedOrderIds(new Set());
      }
    },
    [pendingSchedule, scheduleStop]
  );

  // ─── Remove stop from calendar (new model) ────────
  const handleRemoveFromCalendar = async (stopId: string) => {
    const stop = calendarStops.find((s) => s.id === stopId);
    if (!stop) return;
    try {
      await deleteStop.mutateAsync(stop);
    } catch (err) {
      console.error('Failed to remove stop:', err);
    }
  };

  // ─── Resolve stop (mark as completed / not_completed) ────────
  const handleResolveStop = async (
    stopId: string,
    status: 'completed' | 'not_completed'
  ) => {
    const stop = calendarStops.find((s) => s.id === stopId);
    if (!stop) return;
    try {
      await resolveStop.mutateAsync({ stop, status });
    } catch (err) {
      console.error('Failed to resolve stop:', err);
    }
  };

  // ─── Create free-standing task ────────
  const handleCreateTask = useCallback(
    async (data: {
      driver: DriverName;
      customerName: string;
      address?: string;
      city?: string;
      phone?: string;
      notes?: string;
    }) => {
      if (!taskDialogDate) return;
      try {
        await scheduleStop.mutateAsync({
          deliveryDate: taskDialogDate,
          driver: data.driver,
          sourceType: 'task',
          customerName: data.customerName,
          address: data.address,
          city: data.city,
          phone: data.phone,
          notes: data.notes,
        });
        toast.success(`המשימה נוספה ליומן (${data.driver})`);
      } catch (err) {
        console.error('Failed to create task:', err);
      } finally {
        setTaskDialogDate(null);
      }
    },
    [taskDialogDate, scheduleStop]
  );

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

        <UnscheduledOrders
          orders={unscheduledOrders}
          orderCountByZone={orderCountByZone}
          orderZoneMap={orderZoneMap}
          selectedOrderIds={selectedOrderIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={(ids) => setSelectedOrderIds(new Set(ids))}
          onClearSelection={handleClearSelection}
          onBulkSchedule={handleBulkSchedule}
          isDragging={!!draggedOrder}
        />

        <DeliveryCalendar
          deliveries={calendarDeliveries}
          onRemoveOrder={handleRemoveFromCalendar}
          onAddTask={(date) => setTaskDialogDate(date)}
          onResolveStop={handleResolveStop}
          onViewDayMap={(date) => setMapDialogDate(date)}
        />
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

      {/* Driver Selector — quick pick after drag / date pick */}
      <DriverSelector
        open={driverPickerOpen}
        onClose={() => {
          setDriverPickerOpen(false);
          setPendingSchedule(null);
        }}
        onSelectDriver={handleDriverSelected}
        orderInfo={
          pendingSchedule
            ? pendingSchedule.orders.length > 1
              ? `${pendingSchedule.orders.length} הזמנות`
              : pendingSchedule.orders[0].customerName
            : undefined
        }
        customerName={
          pendingSchedule && pendingSchedule.orders.length === 1
            ? pendingSchedule.orders[0].address ?? undefined
            : undefined
        }
      />

      {/* Date Picker — bulk schedule via click */}
      <DatePickerDialog
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onDateSelected={handleDateSelected}
        orderCount={selectedOrderIds.size}
      />

      {/* Task Dialog — free-standing driver task */}
      <TaskDialog
        open={taskDialogDate !== null}
        onClose={() => setTaskDialogDate(null)}
        date={taskDialogDate}
        onSubmit={handleCreateTask}
      />

      {/* Day Map Dialog — full route + map for a selected day */}
      <DayMapDialog
        open={mapDialogDate !== null}
        onClose={() => setMapDialogDate(null)}
        date={mapDialogDate}
        stops={
          mapDialogDate
            ? (calendarDeliveries
                .filter((d) => d.date === mapDialogDate)
                .flatMap((d) => d.stops))
            : []
        }
        onOptimize={(driver, orderedIds) => {
          if (!mapDialogDate) return;
          reorderStops.mutate({
            deliveryDate: mapDialogDate,
            driver,
            orderedIds,
          });
        }}
      />
    </DndContext>
  );
}
