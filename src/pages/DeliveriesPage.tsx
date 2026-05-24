import { useState, useCallback, useMemo } from 'react';
import { useZonedOrders } from '@/hooks/useZonedOrders';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useScheduleStop } from '@/hooks/useScheduleStop';
import { useDeleteStop } from '@/hooks/useDeleteStop';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useReorderStops } from '@/hooks/useReorderStops';
import { DedupToggle } from '@/components/dashboard/DedupToggle';
import { DeliveryStatusBar } from '@/components/deliveries/DeliveryStatusBar';
import { UnscheduledOrders } from '@/components/deliveries/UnscheduledOrders';
import {
  DuplicateScheduleWarningDialog,
  type DuplicateConflict,
} from '@/components/deliveries/DuplicateScheduleWarningDialog';
import { findActiveDuplicateStops } from '@/lib/calendar-stops';
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
  type CollisionDetection,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import {
  dropAnimationDown,
  silentAnnouncements,
  silentScreenReaderInstructions,
} from '@/lib/dnd-animations';

// Collision detection: כשגוררים הזמנה (order) — נעדיף את ה-day שהמצביע ממש מעליו,
// ונסנן החוצה sortable-stops שנמצאים בעמודות אחרות (חמישי וכו').
// אם המצביע לא ממש על יום — אין hit (drop לא יעשה כלום).
// כשגוררים stop (reorder) — נשתמש ב-closestCenter הרגיל.
const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'order') {
    // 1) pointerWithin — איזה droppable המצביע ממש בתוכו כרגע
    const pointerHits = pointerWithin(args);
    const pointerDayHits = pointerHits.filter(
      (c) =>
        args.droppableContainers.find((d) => d.id === c.id)?.data.current
          ?.type === 'day'
    );
    if (pointerDayHits.length > 0) return pointerDayHits;

    // 2) rectIntersection — אם לא מעל אף יום ישירות, מי חותך את הדראג rect
    const rectHits = rectIntersection(args);
    const rectDayHits = rectHits.filter(
      (c) =>
        args.droppableContainers.find((d) => d.id === c.id)?.data.current
          ?.type === 'day'
    );
    if (rectDayHits.length > 0) return rectDayHits;

    // אין hit — drop ייעצור בלי לפתוח דיאלוג נהג
    return [];
  }

  return closestCenter(args);
};

export function DeliveriesPage() {
  const {
    unscheduledOrders,
    scheduledOrders,
    deliveredOrders,
    orderCountByZone,
    orderZoneMap,
    groupSize: ordersGroupSize,
    hiddenCount: ordersHiddenCount,
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
      // 6px — איזון בין רספונסיביות לבין לחיצה רגילה (toggle select)
      activationConstraint: { distance: 6 },
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

  // Duplicate-prevention dialog (shown when scheduling would create an active dup)
  const [duplicateState, setDuplicateState] = useState<{
    conflicts: DuplicateConflict[];
    nonConflictingOrders: Order[];
    driver: DriverName;
    date: string;
  } | null>(null);

  // IDs של הזמנות שנמצאות בין drop לבחירת נהג —
  // לרינדור opacity מופחת בכרטיס המקור.
  const pendingScheduleIds = useMemo(
    () => new Set<string>(pendingSchedule?.orders.map((o) => o.id) ?? []),
    [pendingSchedule]
  );

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
        coordinationStatus: s.coordinationStatus,
        coordinationMethod: s.coordinationMethod,
        coordinatedAt: s.coordinatedAt,
        timeWindowStart: s.timeWindowStart,
        timeWindowEnd: s.timeWindowEnd,
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

  // Actually run the schedule for a list of orders (no further dup checks)
  const runScheduleOrders = useCallback(
    async (orders: Order[], driver: DriverName, date: string) => {
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
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('calendar_stops_no_active_dup') || msg.includes('duplicate key')) {
          toast.error('השיבוץ נחסם: לקוח זה כבר משובץ פעיל ביומן');
        }
      } finally {
        setPendingSchedule(null);
        setSelectedOrderIds(new Set());
      }
    },
    [scheduleStop]
  );

  // Driver selected → pre-check duplicates → schedule or show warning
  const handleDriverSelected = useCallback(
    async (driver: DriverName) => {
      if (!pendingSchedule) return;
      const { orders, date } = pendingSchedule;
      setDriverPickerOpen(false);

      // Pre-check each order for active duplicate stops
      const conflicts: DuplicateConflict[] = [];
      const nonConflicting: Order[] = [];
      for (const order of orders) {
        try {
          const dupes = await findActiveDuplicateStops({
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            city: order.city,
          });
          if (dupes.length > 0) {
            conflicts.push({
              customerName: order.customerName,
              city: order.city,
              phone: order.phone,
              existing: dupes,
            });
          } else {
            nonConflicting.push(order);
          }
        } catch (err) {
          console.error('pre-check failed for order', order.id, err);
          // On check failure we let the DB constraint catch it
          nonConflicting.push(order);
        }
      }

      if (conflicts.length > 0) {
        setDuplicateState({ conflicts, nonConflictingOrders: nonConflicting, driver, date });
        return;
      }

      await runScheduleOrders(orders, driver, date);
    },
    [pendingSchedule, runScheduleOrders]
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: silentAnnouncements,
        screenReaderInstructions: silentScreenReaderInstructions,
      }}
    >
      <div className="space-y-6">
        <DeliveryStatusBar
          waitingCount={unscheduledOrders.length}
          scheduledCount={scheduledOrders.length}
          deliveredThisWeek={deliveredOrders.length}
        />

        <div className="flex justify-end">
          <DedupToggle hiddenCount={ordersHiddenCount} />
        </div>

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
          pendingScheduleIds={pendingScheduleIds}
          groupSize={ordersGroupSize}
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
      <DragOverlay dropAnimation={dropAnimationDown}>
        {draggedOrder && (() => {
          const isMulti =
            selectedOrderIds.has(draggedOrder.id) &&
            selectedOrderIds.size > 1;
          return (
            <div className="relative">
              {/* Stack visualization — 2 כרטיסים מאחור כשבחירה מרובה */}
              {isMulti && (
                <>
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-60 -rotate-3 translate-y-2 translate-x-2" />
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-80 -rotate-1 translate-y-1 translate-x-1" />
                </>
              )}
              <div className="relative w-56 rounded-xl border-2 border-primary bg-card p-3 shadow-2xl rotate-2 cursor-grabbing ring-4 ring-primary/20">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span className="text-primary">📦</span>
                  <span className="truncate">
                    {draggedOrder.customerName}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {draggedOrder.address}
                  {draggedOrder.city ? `, ${draggedOrder.city}` : ''}
                </div>
                {isMulti && (
                  <div className="absolute -top-2.5 -start-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg ring-2 ring-background">
                    {selectedOrderIds.size}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </DragOverlay>

      {/* Duplicate prevention — shown when scheduling would create an active dup */}
      <DuplicateScheduleWarningDialog
        open={duplicateState !== null}
        onOpenChange={(o) => {
          if (!o) setDuplicateState(null);
        }}
        conflicts={duplicateState?.conflicts ?? []}
        nonConflictingCount={duplicateState?.nonConflictingOrders.length ?? 0}
        onCancel={() => {
          setDuplicateState(null);
          setPendingSchedule(null);
        }}
        onScheduleOthers={() => {
          if (!duplicateState) return;
          const { nonConflictingOrders, driver, date } = duplicateState;
          setDuplicateState(null);
          if (nonConflictingOrders.length > 0) {
            void runScheduleOrders(nonConflictingOrders, driver, date);
          }
        }}
      />

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
