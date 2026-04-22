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
} from '@dnd-kit/core';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Wrench, CalendarDays } from 'lucide-react';
import type { ServiceCall } from '@/types/service-call';
import type { DriverName } from '@/types/route';
import type { CalendarDelivery } from '@/types/delivery';
import { toast } from 'sonner';

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

  const [draggedCall, setDraggedCall] = useState<ServiceCall | null>(null);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{
    call: ServiceCall;
    date: string;
  } | null>(null);
  const [taskDialogDate, setTaskDialogDate] = useState<string | null>(null);
  const [mapDialogDate, setMapDialogDate] = useState<string | null>(null);

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

      setPendingSchedule({ call, date });
      setDriverPickerOpen(true);
    }
  };

  const handleDriverSelected = useCallback(
    async (driver: DriverName) => {
      if (!pendingSchedule) return;
      const { call, date } = pendingSchedule;
      setDriverPickerOpen(false);

      try {
        await scheduleStop.mutateAsync({
          deliveryDate: date,
          driver,
          sourceType: 'service',
          serviceCallId: call.id,
          customerName: call.customerName,
          city: call.city,
          phone: call.phone,
        });
        toast.success(`קריאת השירות שובצה ל${driver}`);
      } catch (err) {
        console.error('schedule failed:', err);
      } finally {
        setPendingSchedule(null);
      }
    },
    [pendingSchedule, scheduleStop]
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
            <UnscheduledServiceCalls
              calls={pendingCalls}
              callCountByZone={callCountByZone}
              callZoneMap={callZoneMap}
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

      <DragOverlay>
        {draggedCall && (
          <div className="w-56 rounded-xl border bg-card p-3 shadow-lg">
            <div className="text-sm font-bold">{draggedCall.customerName}</div>
            {draggedCall.city && (
              <div className="mt-1 truncate text-xs text-muted-foreground">
                🔧 {draggedCall.city}
              </div>
            )}
          </div>
        )}
      </DragOverlay>

      <DriverSelector
        open={driverPickerOpen}
        onClose={() => {
          setDriverPickerOpen(false);
          setPendingSchedule(null);
        }}
        onSelectDriver={handleDriverSelected}
        orderInfo={pendingSchedule?.call.customerName}
        customerName={pendingSchedule?.call.city}
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
