import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  dropAnimationDown,
  silentAnnouncements,
  silentScreenReaderInstructions,
} from '@/lib/dnd-animations';
import { useZonedServiceCalls } from '@/hooks/useZonedServiceCalls';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useScheduleStop } from '@/hooks/useScheduleStop';
import { useDeleteStop } from '@/hooks/useDeleteStop';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useReorderStops } from '@/hooks/useReorderStops';
import { ServiceCallStatusBar } from '@/components/service-calls/ServiceCallStatusBar';
import { UnscheduledServiceCalls } from '@/components/service-calls/UnscheduledServiceCalls';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { DriverSelector } from '@/components/deliveries/DriverSelector';
import { TaskDialog } from '@/components/deliveries/TaskDialog';
import { DayMapDialog } from '@/components/deliveries/DayMapDialog';
import { DatePickerDialog } from '@/components/deliveries/DatePickerDialog';
import { DedupToggle } from '@/components/dashboard/DedupToggle';
import {
  DuplicateScheduleWarningDialog,
  type DuplicateConflict,
} from '@/components/deliveries/DuplicateScheduleWarningDialog';
import { findActiveDuplicateStops } from '@/lib/calendar-stops';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Wrench, CalendarDays } from 'lucide-react';
import type { ServiceCall } from '@/types/service-call';
import type { DriverName } from '@/types/route';
import type { CalendarDelivery } from '@/types/delivery';
import { toast } from 'sonner';

// כשגוררים קריאת שירות — נעדיף את ה-day שהמצביע ממש מעליו,
// ונסנן החוצה sortable-stops שנמצאים ביום אחר. אם לא ממש על יום —
// אין hit (drop לא יעשה כלום).
const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'serviceCall') {
    const pointerHits = pointerWithin(args);
    const pointerDayHits = pointerHits.filter(
      (c) =>
        args.droppableContainers.find((d) => d.id === c.id)?.data.current
          ?.type === 'day'
    );
    if (pointerDayHits.length > 0) return pointerDayHits;

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

export function ServiceCallsPage() {
  const {
    pendingCalls,
    scheduledCalls,
    completedCalls,
    callCountByZone,
    callZoneMap,
    groupSize: callsGroupSize,
    hiddenCount: callsHiddenCount,
    isLoading,
    error,
  } = useZonedServiceCalls();

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

  const [draggedCall, setDraggedCall] = useState<ServiceCall | null>(null);
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{
    calls: ServiceCall[];
    date: string;
  } | null>(null);
  const [taskDialogDate, setTaskDialogDate] = useState<string | null>(null);
  const [mapDialogDate, setMapDialogDate] = useState<string | null>(null);

  // Duplicate-prevention dialog
  const [duplicateState, setDuplicateState] = useState<{
    conflicts: DuplicateConflict[];
    nonConflictingCalls: ServiceCall[];
    driver: DriverName;
    date: string;
  } | null>(null);

  const handleToggleSelect = useCallback((callId: string) => {
    setSelectedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCallIds(new Set());
  }, []);

  const handleBulkSchedule = useCallback(() => {
    if (selectedCallIds.size === 0) return;
    setDatePickerOpen(true);
  }, [selectedCallIds]);

  // IDs של קריאות שירות שמחכות לבחירת נהג — opacity מופחת בכרטיס המקור.
  const pendingScheduleIds = useMemo(
    () => new Set<string>(pendingSchedule?.calls.map((c) => c.id) ?? []),
    [pendingSchedule]
  );

  // יומן משולב — מציג משלוחים + קריאות שירות באותה תצוגה
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

  // ─── Drag handlers ────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'serviceCall') {
      setDraggedCall(active.data.current.call as ServiceCall);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedCall(null);

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

    if (active.data.current?.type === 'serviceCall') {
      const over_t = over.data.current?.type;
      let date: string | undefined;
      if (over_t === 'day') {
        date = over.data.current?.date as string;
      } else if (over_t === 'stop') {
        date = over.data.current?.deliveryDate as string;
      }
      if (!date) return;

      const call = active.data.current.call as ServiceCall;

      // חסימת שישי/שבת
      const targetDay = new Date(date + 'T00:00:00').getDay();
      if (targetDay === 5 || targetDay === 6) {
        toast.error('לא ניתן לתזמן ליום שישי או שבת');
        return;
      }

      // אם הקריאה הנגררת היא חלק מבחירה מרובה — קח את כולן
      let callsForSchedule: ServiceCall[];
      if (selectedCallIds.has(call.id) && selectedCallIds.size > 1) {
        callsForSchedule = pendingCalls.filter((c) =>
          selectedCallIds.has(c.id)
        );
      } else {
        callsForSchedule = [call];
      }

      setPendingSchedule({ calls: callsForSchedule, date });
      setDriverPickerOpen(true);
    }
  };

  const handleDateSelected = useCallback(
    (date: string) => {
      const callsForSchedule = pendingCalls.filter((c) =>
        selectedCallIds.has(c.id)
      );
      if (callsForSchedule.length === 0) {
        setDatePickerOpen(false);
        return;
      }
      setPendingSchedule({ calls: callsForSchedule, date });
      setDriverPickerOpen(true);
      setDatePickerOpen(false);
    },
    [pendingCalls, selectedCallIds]
  );

  const runScheduleCalls = useCallback(
    async (calls: ServiceCall[], driver: DriverName, date: string) => {
      try {
        for (const call of calls) {
          await scheduleStop.mutateAsync({
            deliveryDate: date,
            driver,
            sourceType: 'service',
            serviceCallId: call.id,
            customerName: call.customerName,
            city: call.city,
            phone: call.phone,
          });
        }
        toast.success(
          calls.length > 1
            ? `שובצו ${calls.length} קריאות ל${driver}`
            : `קריאת השירות שובצה ל${driver}`
        );
      } catch (err) {
        console.error('schedule failed:', err);
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('calendar_stops_no_active_dup') || msg.includes('duplicate key')) {
          toast.error('השיבוץ נחסם: לקוח זה כבר משובץ פעיל ביומן');
        }
      } finally {
        setPendingSchedule(null);
        setSelectedCallIds(new Set());
      }
    },
    [scheduleStop]
  );

  const handleDriverSelected = useCallback(
    async (driver: DriverName) => {
      if (!pendingSchedule) return;
      const { calls, date } = pendingSchedule;
      setDriverPickerOpen(false);

      // Pre-check each call for active duplicate stops
      const conflicts: DuplicateConflict[] = [];
      const nonConflicting: ServiceCall[] = [];
      for (const call of calls) {
        try {
          const dupes = await findActiveDuplicateStops({
            customerName: call.customerName,
            phone: call.phone,
            city: call.city,
          });
          if (dupes.length > 0) {
            conflicts.push({
              customerName: call.customerName,
              city: call.city,
              phone: call.phone,
              existing: dupes,
            });
          } else {
            nonConflicting.push(call);
          }
        } catch (err) {
          console.error('pre-check failed for call', call.id, err);
          nonConflicting.push(call);
        }
      }

      if (conflicts.length > 0) {
        setDuplicateState({
          conflicts,
          nonConflictingCalls: nonConflicting,
          driver,
          date,
        });
        return;
      }

      await runScheduleCalls(calls, driver, date);
    },
    [pendingSchedule, runScheduleCalls]
  );

  const handleRemoveFromCalendar = async (stopId: string) => {
    const stop = calendarStops.find((s) => s.id === stopId);
    if (!stop) return;
    try {
      await deleteStop.mutateAsync(stop);
    } catch (err) {
      console.error('Failed to remove stop:', err);
    }
  };

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

  const scheduledServiceStops = calendarStops.filter(
    (s) => s.sourceType === 'service' && s.status !== 'cancelled'
  ).length;

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
        <ServiceCallStatusBar
          pendingCount={pendingCalls.length}
          scheduledCount={scheduledCalls.length}
          completedCount={completedCalls.length}
        />

        <Tabs defaultValue="pending" dir="rtl">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              קריאות ממתינות
              <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                {pendingCalls.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              יומן משולב
              {scheduledServiceStops > 0 && (
                <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                  {scheduledServiceStops}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <div className="flex justify-end">
              <DedupToggle hiddenCount={callsHiddenCount} />
            </div>
            <UnscheduledServiceCalls
              calls={pendingCalls}
              callCountByZone={callCountByZone}
              callZoneMap={callZoneMap}
              groupSize={callsGroupSize}
              selectedCallIds={selectedCallIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={(ids) => setSelectedCallIds(new Set(ids))}
              onClearSelection={handleClearSelection}
              onBulkSchedule={handleBulkSchedule}
              pendingScheduleIds={pendingScheduleIds}
            />

            <DeliveryCalendar
              deliveries={calendarDeliveries}
              onRemoveOrder={handleRemoveFromCalendar}
              onAddTask={(date) => setTaskDialogDate(date)}
              onResolveStop={handleResolveStop}
              onViewDayMap={(date) => setMapDialogDate(date)}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <DeliveryCalendar
              deliveries={calendarDeliveries}
              onRemoveOrder={handleRemoveFromCalendar}
              onAddTask={(date) => setTaskDialogDate(date)}
              onResolveStop={handleResolveStop}
              onViewDayMap={(date) => setMapDialogDate(date)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DragOverlay dropAnimation={dropAnimationDown}>
        {draggedCall && (() => {
          const isMulti =
            selectedCallIds.has(draggedCall.id) && selectedCallIds.size > 1;
          return (
            <div className="relative">
              {/* Stack visualization — 2 כרטיסים מאחור כשבחירה מרובה */}
              {isMulti && (
                <>
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-60 -rotate-3 translate-y-2 translate-x-2" />
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-80 -rotate-1 translate-y-1 translate-x-1" />
                </>
              )}
              <div className="relative w-56 rounded-xl border-2 border-orange-400 bg-card p-3 shadow-2xl rotate-2 cursor-grabbing ring-4 ring-orange-400/20">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span className="text-orange-600">🔧</span>
                  <span className="truncate">{draggedCall.customerName}</span>
                </div>
                {draggedCall.city && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {draggedCall.city}
                  </div>
                )}
                {isMulti && (
                  <div className="absolute -top-2.5 -start-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-lg ring-2 ring-background">
                    {selectedCallIds.size}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </DragOverlay>

      <DuplicateScheduleWarningDialog
        open={duplicateState !== null}
        onOpenChange={(o) => {
          if (!o) setDuplicateState(null);
        }}
        conflicts={duplicateState?.conflicts ?? []}
        nonConflictingCount={
          duplicateState?.nonConflictingCalls.length ?? 0
        }
        onCancel={() => {
          setDuplicateState(null);
          setPendingSchedule(null);
        }}
        onScheduleOthers={() => {
          if (!duplicateState) return;
          const { nonConflictingCalls, driver, date } = duplicateState;
          setDuplicateState(null);
          if (nonConflictingCalls.length > 0) {
            void runScheduleCalls(nonConflictingCalls, driver, date);
          }
        }}
      />

      <DatePickerDialog
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onDateSelected={handleDateSelected}
        orderCount={selectedCallIds.size}
      />

      <DriverSelector
        open={driverPickerOpen}
        onClose={() => {
          setDriverPickerOpen(false);
          setPendingSchedule(null);
        }}
        onSelectDriver={handleDriverSelected}
        orderInfo={
          pendingSchedule
            ? pendingSchedule.calls.length > 1
              ? `${pendingSchedule.calls.length} קריאות שירות`
              : pendingSchedule.calls[0].customerName
            : undefined
        }
        customerName={
          pendingSchedule && pendingSchedule.calls.length === 1
            ? pendingSchedule.calls[0].city ?? undefined
            : undefined
        }
      />

      <TaskDialog
        open={taskDialogDate !== null}
        onClose={() => setTaskDialogDate(null)}
        date={taskDialogDate}
        onSubmit={handleCreateTask}
      />

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
