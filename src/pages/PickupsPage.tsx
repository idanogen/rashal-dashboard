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
import { usePickups } from '@/hooks/usePickups';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useScheduleStop } from '@/hooks/useScheduleStop';
import { useDeleteStop } from '@/hooks/useDeleteStop';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useReorderStops } from '@/hooks/useReorderStops';
import { useRescheduleStop, type RescheduleStopRef } from '@/hooks/useRescheduleStop';
import { UnscheduledPickups } from '@/components/pickups/UnscheduledPickups';
import { PickupDetailDialog } from '@/components/pickups/PickupDetailDialog';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { DriverSelector } from '@/components/deliveries/DriverSelector';
import { DatePickerDialog } from '@/components/deliveries/DatePickerDialog';
import { DayMapDialog } from '@/components/deliveries/DayMapDialog';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { showScheduleToast } from '@/lib/scheduleToast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, Undo2, CalendarDays } from 'lucide-react';
import type { Pickup } from '@/types/pickup';
import { ASSIGNEES, type AssigneeName } from '@/types/route';
import type { CalendarDelivery } from '@/types/delivery';
import { buildCalendarDeliveries } from '@/lib/calendar-view';
import { toast } from 'sonner';

// גרירת איסוף — נעדיף את היום שהמצביע מעליו; drop מחוץ ליום לא עושה כלום.
const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;
  if (activeType === 'pickup') {
    const pointerHits = pointerWithin(args);
    const pointerDayHits = pointerHits.filter(
      (c) => args.droppableContainers.find((d) => d.id === c.id)?.data.current?.type === 'day'
    );
    if (pointerDayHits.length > 0) return pointerDayHits;
    const rectHits = rectIntersection(args);
    const rectDayHits = rectHits.filter(
      (c) => args.droppableContainers.find((d) => d.id === c.id)?.data.current?.type === 'day'
    );
    if (rectDayHits.length > 0) return rectDayHits;
    return [];
  }
  return closestCenter(args);
};

export function PickupsPage() {
  const { data: pickups = [], isLoading, error } = usePickups();
  const { data: calendarStops = [] } = useCalendarStops();
  const scheduleStop = useScheduleStop();
  const deleteStop = useDeleteStop();
  const resolveStop = useResolveStop();
  const reorderStops = useReorderStops();
  const rescheduleStopMut = useRescheduleStop();
  const log = useActivityLogger();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [draggedPickup, setDraggedPickup] = useState<Pickup | null>(null);
  const [draggedStop, setDraggedStop] = useState<{ customerName: string; city?: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{ pickups: Pickup[]; date: string } | null>(null);
  const [mapDialogDate, setMapDialogDate] = useState<string | null>(null);
  const [detailPickup, setDetailPickup] = useState<Pickup | null>(null);
  const [notCompletedStop, setNotCompletedStop] = useState<(typeof calendarStops)[number] | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{ stop: RescheduleStopRef; newDate: string } | null>(null);

  // ─── Derived data ──────────────────────────────────────────
  const pendingPickups = useMemo(
    () =>
      pickups.filter(
        (p) =>
          !p.duplicateOf &&
          (p.pickupStatus ?? 'ממתין לתאום') === 'ממתין לתאום' &&
          // רשת ביטחון: איסוף שכבר נאסף/בוטל בפריוריטי לא מופיע בממתינים
          p.priorityStatus !== 'סופית' &&
          p.priorityStatus !== 'מבוטלת'
      ),
    [pickups]
  );

  const scheduledCount = useMemo(
    () => calendarStops.filter((s) => s.sourceType === 'pickup' && (s.status === 'planned' || s.status === 'in_progress')).length,
    [calendarStops]
  );
  // "נאסף" = איסופים שסומנו כנאספו (רובם ישירות מפריוריטי בסטטוס סופית).
  const completedCount = useMemo(
    () => pickups.filter((p) => p.pickupStatus === 'נאסף').length,
    [pickups]
  );

  const returnedIds = useMemo(
    () =>
      new Set<string>(
        calendarStops
          .filter((s) => s.status === 'not_completed' && s.sourceType === 'pickup' && s.pickupId)
          .map((s) => s.pickupId as string)
      ),
    [calendarStops]
  );

  const pendingScheduleIds = useMemo(
    () => new Set<string>(pendingSchedule?.pickups.map((p) => p.id) ?? []),
    [pendingSchedule]
  );

  // יומן מאוחד — כל הסוגים יחד (משלוחים + שירות + איסופים + משימות).
  const calendarDeliveries: CalendarDelivery[] = useMemo(
    () => buildCalendarDeliveries(calendarStops),
    [calendarStops]
  );

  // ─── Selection ─────────────────────────────────────────────
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const handleBulkSchedule = useCallback(() => {
    if (selectedIds.size > 0) setDatePickerOpen(true);
  }, [selectedIds]);

  // ─── Reschedule ────────────────────────────────────────────
  const buildRescheduleRef = (stopId: string): RescheduleStopRef | null => {
    const s = calendarStops.find((cs) => cs.id === stopId);
    if (!s) return null;
    return {
      stopId: s.id,
      sourceId: s.orderId ?? s.serviceCallId ?? s.pickupId ?? s.id,
      sourceType: s.sourceType,
      deliveryDate: s.deliveryDate,
      driver: s.driver as AssigneeName,
      coordinationStatus: s.coordinationStatus,
      timeWindowStart: s.timeWindowStart,
      timeWindowEnd: s.timeWindowEnd,
    };
  };
  const startReschedule = (stopId: string, newDate: string) => {
    const targetDay = new Date(newDate + 'T00:00:00').getDay();
    if (targetDay === 5 || targetDay === 6) {
      toast.error('לא ניתן לתזמן ליום שישי או שבת');
      return;
    }
    const ref = buildRescheduleRef(stopId);
    if (!ref || ref.deliveryDate === newDate) return;
    setPendingReschedule({ stop: ref, newDate });
  };
  const handleRescheduleDriverSelected = (newDriver: AssigneeName) => {
    if (!pendingReschedule) return;
    rescheduleStopMut.mutate({ stop: pendingReschedule.stop, newDate: pendingReschedule.newDate, newDriver });
    setPendingReschedule(null);
  };

  // ─── Drag handlers ─────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'pickup') {
      setDraggedPickup(active.data.current.pickup as Pickup);
    } else if (active.data.current?.type === 'stop') {
      const s = calendarStops.find((cs) => cs.id === active.id);
      if (s) setDraggedStop({ customerName: s.customerName, city: s.city });
    }
  };
  const handleDragCancel = () => {
    setDraggedPickup(null);
    setDraggedStop(null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedPickup(null);
    setDraggedStop(null);
    if (!over) return;

    // Reorder / reschedule of an existing stop
    if (active.data.current?.type === 'stop' && over.data.current?.type === 'stop' && active.id !== over.id) {
      const srcDate = active.data.current.deliveryDate as string;
      const srcDriver = active.data.current.driver as AssigneeName;
      const overDate = over.data.current.deliveryDate as string;
      const overDriver = over.data.current.driver as AssigneeName;
      if (srcDate !== overDate) {
        startReschedule(active.id as string, overDate);
        return;
      }
      if (srcDriver !== overDriver) return;
      const groupStops = calendarStops
        .filter((s) => s.deliveryDate === srcDate && s.driver === srcDriver && s.status !== 'cancelled')
        .sort((a, b) => a.sequence - b.sequence)
        .map((s) => s.id);
      const oldIndex = groupStops.indexOf(active.id as string);
      const newIndex = groupStops.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = [...groupStops];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      reorderStops.mutate({ deliveryDate: srcDate, driver: srcDriver, orderedIds: next });
      return;
    }

    if (active.data.current?.type === 'stop' && over.data.current?.type === 'day') {
      const newDate = over.data.current?.date as string;
      if (newDate) startReschedule(active.id as string, newDate);
      return;
    }

    if (active.data.current?.type === 'pickup') {
      const over_t = over.data.current?.type;
      let date: string | undefined;
      if (over_t === 'day') date = over.data.current?.date as string;
      else if (over_t === 'stop') date = over.data.current?.deliveryDate as string;
      if (!date) return;

      const targetDay = new Date(date + 'T00:00:00').getDay();
      if (targetDay === 5 || targetDay === 6) {
        toast.error('לא ניתן לתזמן ליום שישי או שבת');
        return;
      }
      const pickup = active.data.current.pickup as Pickup;
      let forSchedule: Pickup[];
      if (selectedIds.has(pickup.id) && selectedIds.size > 1) {
        forSchedule = pendingPickups.filter((p) => selectedIds.has(p.id));
      } else {
        forSchedule = [pickup];
      }
      setPendingSchedule({ pickups: forSchedule, date });
      setDriverPickerOpen(true);
    }
  };

  const handleDateSelected = useCallback(
    (date: string) => {
      const forSchedule = pendingPickups.filter((p) => selectedIds.has(p.id));
      if (forSchedule.length === 0) {
        setDatePickerOpen(false);
        return;
      }
      setPendingSchedule({ pickups: forSchedule, date });
      setDriverPickerOpen(true);
      setDatePickerOpen(false);
    },
    [pendingPickups, selectedIds]
  );

  const runSchedule = useCallback(
    async (list: Pickup[], driver: AssigneeName, date: string) => {
      try {
        for (const p of list) {
          await scheduleStop.mutateAsync({
            deliveryDate: date,
            driver,
            sourceType: 'pickup',
            pickupId: p.id,
            customerName: p.customerName,
            address: p.address,
            city: p.city,
            phone: p.phone,
          });
        }
        showScheduleToast({ count: list.length, assignee: driver, date, kind: 'delivery' });
      } catch (err) {
        console.error('schedule failed:', err);
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('calendar_stops_no_active_dup') || msg.includes('duplicate key')) {
          toast.error('השיבוץ נחסם: לקוח זה כבר משובץ פעיל ביומן');
        }
      } finally {
        setPendingSchedule(null);
        setSelectedIds(new Set());
      }
    },
    [scheduleStop]
  );

  const handleDriverSelected = useCallback(
    async (driver: AssigneeName) => {
      if (!pendingSchedule) return;
      const { pickups: list, date } = pendingSchedule;
      setDriverPickerOpen(false);
      await runSchedule(list, driver, date);
    },
    [pendingSchedule, runSchedule]
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

  const handleResolveStop = async (stopId: string, status: 'completed' | 'not_completed') => {
    const stop = calendarStops.find((s) => s.id === stopId);
    if (!stop) return;
    if (status === 'not_completed') {
      setNotCompletedStop(stop);
      return;
    }
    log('stop_completed', {
      entityType: 'calendar_stop',
      entityId: stop.id,
      sourceType: stop.sourceType,
      customerName: stop.customerName,
    });
    try {
      await resolveStop.mutateAsync({ stop, status });
    } catch (err) {
      console.error('Failed to resolve stop:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">טוען איסופים...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">שגיאה בטעינת הנתונים</p>
        <p className="max-w-md text-center text-xs text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: silentAnnouncements,
        screenReaderInstructions: silentScreenReaderInstructions,
      }}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">ממתינים לתיאום</p>
            <p className="mt-1 text-2xl font-bold text-teal-600">{pendingPickups.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">משובצים ביומן</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{scheduledCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">נאספו</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{completedCount}</p>
          </Card>
        </div>

        <Tabs defaultValue="pending" dir="rtl">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Undo2 className="h-4 w-4" />
              איסופים ממתינים
              <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                {pendingPickups.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              יומן איסופים
              {scheduledCount > 0 && (
                <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                  {scheduledCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <UnscheduledPickups
              pickups={pendingPickups}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={(ids) => setSelectedIds(new Set(ids))}
              onClearSelection={handleClearSelection}
              onBulkSchedule={handleBulkSchedule}
              pendingScheduleIds={pendingScheduleIds}
              returnedIds={returnedIds}
              onShowDetails={setDetailPickup}
            />
            <DeliveryCalendar
              deliveries={calendarDeliveries}
              onRemoveOrder={handleRemoveFromCalendar}
              onResolveStop={handleResolveStop}
              onViewDayMap={(date) => setMapDialogDate(date)}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <DeliveryCalendar
              deliveries={calendarDeliveries}
              onRemoveOrder={handleRemoveFromCalendar}
              onResolveStop={handleResolveStop}
              onViewDayMap={(date) => setMapDialogDate(date)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DragOverlay dropAnimation={dropAnimationDown}>
        {draggedStop && (
          <div className="w-56 rounded-xl border-2 border-teal-500 bg-card p-3 shadow-2xl rotate-2 cursor-grabbing ring-4 ring-teal-500/20">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <span>↩️</span>
              <span className="truncate">{draggedStop.customerName}</span>
            </div>
            {draggedStop.city && (
              <div className="mt-1 truncate text-xs text-muted-foreground">{draggedStop.city}</div>
            )}
          </div>
        )}
        {draggedPickup && (() => {
          const isMulti = selectedIds.has(draggedPickup.id) && selectedIds.size > 1;
          return (
            <div className="relative">
              {isMulti && (
                <>
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-60 -rotate-3 translate-y-2 translate-x-2" />
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-80 -rotate-1 translate-y-1 translate-x-1" />
                </>
              )}
              <div className="relative w-56 rounded-xl border-2 border-teal-400 bg-card p-3 shadow-2xl rotate-2 cursor-grabbing ring-4 ring-teal-400/20">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span className="text-teal-600">↩️</span>
                  <span className="truncate">{draggedPickup.customerName}</span>
                </div>
                {draggedPickup.city && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">{draggedPickup.city}</div>
                )}
                {isMulti && (
                  <div className="absolute -top-2.5 -start-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white shadow-lg ring-2 ring-background">
                    {selectedIds.size}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </DragOverlay>

      <PickupDetailDialog
        pickup={detailPickup}
        open={!!detailPickup}
        onOpenChange={(o) => !o && setDetailPickup(null)}
      />

      <NotCompletedReasonDialog
        open={!!notCompletedStop}
        customerName={notCompletedStop?.customerName}
        submitting={resolveStop.isPending}
        onOpenChange={(o) => {
          if (!o) setNotCompletedStop(null);
        }}
        onConfirm={(reason) => {
          if (!notCompletedStop) return;
          log('stop_not_completed', {
            entityType: 'calendar_stop',
            entityId: notCompletedStop.id,
            sourceType: notCompletedStop.sourceType,
            customerName: notCompletedStop.customerName,
            metadata: { reason },
          });
          resolveStop.mutate(
            { stop: notCompletedStop, status: 'not_completed', notes: reason },
            { onSuccess: () => setNotCompletedStop(null) }
          );
        }}
      />

      <DatePickerDialog
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onDateSelected={handleDateSelected}
        orderCount={selectedIds.size}
      />

      <DriverSelector
        assignees={ASSIGNEES}
        title="בחר עובד לאיסוף"
        open={driverPickerOpen}
        onClose={() => {
          setDriverPickerOpen(false);
          setPendingSchedule(null);
        }}
        onSelectDriver={handleDriverSelected}
        orderInfo={
          pendingSchedule
            ? pendingSchedule.pickups.length > 1
              ? `${pendingSchedule.pickups.length} איסופים`
              : pendingSchedule.pickups[0].customerName
            : undefined
        }
        customerName={
          pendingSchedule && pendingSchedule.pickups.length === 1
            ? pendingSchedule.pickups[0].city ?? undefined
            : undefined
        }
      />

      <DriverSelector
        assignees={ASSIGNEES}
        title="בחר עובד לאיסוף"
        open={!!pendingReschedule}
        onClose={() => setPendingReschedule(null)}
        onSelectDriver={handleRescheduleDriverSelected}
        orderInfo={
          pendingReschedule
            ? `שיבוץ מחדש ל-${new Date(pendingReschedule.newDate + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`
            : undefined
        }
      />

      <DayMapDialog
        open={mapDialogDate !== null}
        onClose={() => setMapDialogDate(null)}
        date={mapDialogDate}
        stops={mapDialogDate ? calendarDeliveries.filter((d) => d.date === mapDialogDate).flatMap((d) => d.stops) : []}
        onOptimize={(driver, orderedIds) => {
          if (!mapDialogDate) return;
          reorderStops.mutate({ deliveryDate: mapDialogDate, driver, orderedIds });
        }}
      />
    </DndContext>
  );
}
