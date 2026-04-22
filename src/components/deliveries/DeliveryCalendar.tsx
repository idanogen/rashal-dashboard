import { useState, useMemo } from 'react';
import type { CalendarDelivery, CalendarStop } from '@/types/delivery';
import { DRIVER_CONFIG } from '@/types/delivery';
import type { DriverName } from '@/types/route';
import { Button } from '@/components/ui/button';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Truck,
  MapPin,
  Trash2,
  GripVertical,
  Phone,
  Package,
  Wrench,
  ClipboardList,
  Plus,
  Check,
  X,
  Map as MapIcon,
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

// פורמט תאריך מקומי (לא UTC) למניעת באגי timezone
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface DeliveryCalendarProps {
  deliveries: CalendarDelivery[];
  /** Called with the calendar_stops.id to remove (single source of truth) */
  onRemoveOrder?: (stopId: string) => void;
  /** Called when user clicks "+" on a day to create a free-standing task */
  onAddTask?: (dateStr: string) => void;
  /** Called to mark a stop as completed / not_completed */
  onResolveStop?: (stopId: string, status: 'completed' | 'not_completed') => void;
  /** Called when user clicks "map" on a day to see the full day's route */
  onViewDayMap?: (dateStr: string) => void;
}

// ─── Stop Card ─────────────────────────────────────────────

interface StopCardProps {
  stop: CalendarStop;
  delivery: CalendarDelivery;
  onRemove?: (stopId: string) => void;
  onResolve?: (stopId: string, status: 'completed' | 'not_completed') => void;
}

function StopCard({ stop, delivery, onRemove, onResolve }: StopCardProps) {
  const config = DRIVER_CONFIG[delivery.driver];

  // Sortable — sortable-drag רק כשעוצמת ה-stop לא resolved
  const isResolved = stop.status === 'completed' || stop.status === 'not_completed';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stop.stopId,
    data: {
      type: 'stop',
      stopId: stop.stopId,
      deliveryDate: delivery.date,
      driver: delivery.driver,
    },
    disabled: isResolved,
  });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // אייקון + צבע לפי סוג מקור
  const sourceConfig = {
    delivery: { Icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'משלוח' },
    service: { Icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', label: 'שירות' },
    task: { Icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', label: 'משימה' },
  } as const;
  const src = sourceConfig[stop.sourceType];
  const SrcIcon = src.Icon;

  // רקע לפי סטטוס
  const statusBg =
    stop.status === 'completed'
      ? 'bg-emerald-50/80 dark:bg-emerald-900/20'
      : stop.status === 'not_completed'
        ? 'bg-red-50/60 dark:bg-red-900/20'
        : 'bg-background/60';
  const nameClass =
    stop.status === 'not_completed'
      ? 'line-through text-muted-foreground'
      : '';

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`
        group rounded-lg border-s-[3px] ${config.borderColor} border ${statusBg}
        p-2 transition-all duration-200 hover:shadow-md
        ${!isResolved ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      {...(isResolved ? {} : { ...listeners, ...attributes })}
    >
      {/* Top row: source icon + customer name + driver badge + action buttons */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-md ${src.bg} ${src.color} flex-shrink-0`}
            title={src.label}
          >
            <SrcIcon className="h-3 w-3" />
          </span>
          <span className={`font-semibold text-xs truncate ${nameClass}`}>
            {stop.customerName}
          </span>
          {stop.status === 'completed' && (
            <Check className="h-3 w-3 text-emerald-600 flex-shrink-0" aria-label="בוצע" />
          )}
          {stop.status === 'not_completed' && (
            <X className="h-3 w-3 text-red-600 flex-shrink-0" aria-label="לא בוצע" />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Resolve buttons — always visible when planned/in_progress */}
          {onResolve && !isResolved && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(stop.stopId, 'completed');
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors"
                title="סמן כבוצע"
              >
                <Check className="h-2.5 w-2.5" />
                בוצע
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(stop.stopId, 'not_completed');
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-500/20 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                title="סמן כלא בוצע"
              >
                <X className="h-2.5 w-2.5" />
                לא בוצע
              </button>
            </>
          )}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(stop.stopId);
              }}
              className="h-5 w-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
              title="הסר מהיומן"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          )}
        </div>
      </div>

      {/* Address */}
      {(stop.address || stop.city) && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5 truncate">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">
            {stop.address}
            {stop.city ? `, ${stop.city}` : ''}
          </span>
        </p>
      )}

      {/* Phone */}
      {stop.phone && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
          <Phone className="h-2.5 w-2.5 flex-shrink-0" />
          <a href={`tel:${stop.phone}`} className="hover:text-primary" dir="ltr">
            {stop.phone}
          </a>
        </p>
      )}
    </div>
  );
}

// ─── Day Drop Zone ─────────────────────────────────────────

function DayDropZone({
  date,
  children,
  isToday,
  isPast,
}: {
  date: Date;
  children: React.ReactNode;
  isToday: boolean;
  isPast: boolean;
}) {
  const dateStr = toLocalDateStr(date);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dateStr}`,
    data: { type: 'day', date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border bg-card shadow-sm transition-all duration-200 overflow-hidden ${
        isToday ? 'ring-2 ring-primary shadow-md' : ''
      } ${isPast ? 'opacity-70' : ''} ${
        isOver
          ? 'ring-2 ring-primary bg-primary/5 scale-[1.02] shadow-lg'
          : ''
      }`}
    >
      {children}
    </div>
  );
}

// ─── Calendar Component ─────────────────────────────────────

const MIN_VISIBLE_DAYS = 3;

export function DeliveryCalendar({
  deliveries,
  onRemoveOrder,
  onAddTask,
  onResolveStop,
  onViewDayMap,
}: DeliveryCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const dayNames = [
    'ראשון',
    'שני',
    'שלישי',
    'רביעי',
    'חמישי',
    'שישי',
    'שבת',
  ];

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  // Get working days (Sun-Thu) for a given week
  const getWeekWorkDays = (date: Date): Date[] => {
    const days: Date[] = [];
    const current = new Date(date);
    current.setDate(current.getDate() - current.getDay()); // Go to Sunday

    for (let i = 0; i < 7; i++) {
      const day = new Date(current);
      if (day.getDay() !== 5 && day.getDay() !== 6) {
        days.push(day);
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const getDeliveriesForDate = (dateStr: string): CalendarDelivery[] => {
    return deliveries.filter((d) => d.date === dateStr);
  };

  const isPastDay = (date: Date): boolean => {
    return toLocalDateStr(date) < todayStr;
  };

  const isToday = (date: Date): boolean => {
    return toLocalDateStr(date) === todayStr;
  };

  // Flatten all stops for a given date
  const getStopsForDate = (
    dateStr: string
  ): { stop: CalendarStop; delivery: CalendarDelivery }[] => {
    const dayDeliveries = getDeliveriesForDate(dateStr);
    const stops: { stop: CalendarStop; delivery: CalendarDelivery }[] = [];
    for (const delivery of dayDeliveries) {
      for (const stop of delivery.stops) {
        stops.push({ stop, delivery });
      }
    }
    return stops;
  };

  // Calculate visible days
  const visibleDays = useMemo(() => {
    const weekDays = getWeekWorkDays(currentDate);
    const currentAndFuture = weekDays.filter((d) => !isPastDay(d));
    const pastWithStops = weekDays.filter((d) => {
      if (!isPastDay(d)) return false;
      const dateStr = toLocalDateStr(d);
      return getDeliveriesForDate(dateStr).length > 0;
    });

    let visible = [...pastWithStops, ...currentAndFuture];

    // If fewer than MIN_VISIBLE_DAYS, extend to next week
    if (visible.length < MIN_VISIBLE_DAYS) {
      const nextWeekStart = new Date(currentDate);
      nextWeekStart.setDate(
        nextWeekStart.getDate() - nextWeekStart.getDay() + 7
      );
      const nextWeekDays = getWeekWorkDays(nextWeekStart);

      for (const day of nextWeekDays) {
        if (visible.length >= MIN_VISIBLE_DAYS) break;
        if (!visible.some((d) => toLocalDateStr(d) === toLocalDateStr(day))) {
          visible.push(day);
        }
      }
    }

    return visible;
  }, [currentDate, deliveries, todayStr]);

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const formatMonthYear = () =>
    currentDate.toLocaleDateString('he-IL', {
      month: 'long',
      year: 'numeric',
    });

  // Dynamic grid columns
  const gridCols =
    visibleDays.length <= 3
      ? 'xl:grid-cols-3'
      : visibleDays.length <= 4
        ? 'xl:grid-cols-4'
        : 'xl:grid-cols-5';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{formatMonthYear()}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="rounded-lg font-medium"
          >
            היום
          </Button>
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousWeek}
              className="h-8 w-8 rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextWeek}
              className="h-8 w-8 rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Week Grid */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gridCols} gap-4`}
      >
        {visibleDays.map((day) => {
          const dateStr = toLocalDateStr(day);
          const dayStops = getStopsForDate(dateStr);
          // קיבוץ לפי נהג — רודי דויד קודם, אחר כך נהג חיצוני
          const driverOrder: DriverName[] = ['רודי דויד', 'נהג חיצוני מועלם'];
          const dayDeliveries = getDeliveriesForDate(dateStr).sort(
            (a, b) =>
              driverOrder.indexOf(a.driver) - driverOrder.indexOf(b.driver)
          );
          const isTodayFlag = isToday(day);
          const isPast = isPastDay(day);

          return (
            <DayDropZone
              key={day.toISOString()}
              date={day}
              isToday={isTodayFlag}
              isPast={isPast}
            >
              {/* Day Header */}
              <div
                className={`border-b p-3 ${
                  isTodayFlag
                    ? 'bg-primary/10'
                    : isPast
                      ? 'bg-amber-500/5'
                      : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-semibold text-sm ${
                        isTodayFlag
                          ? 'text-primary'
                          : isPast
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {dayNames[day.getDay()]}
                    </span>
                    {onAddTask && !isPast && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30"
                        onClick={() => onAddTask(dateStr)}
                        title="הוסף משימה לנהג"
                      >
                        <Plus className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                    )}
                  </div>
                  <div className="text-left">
                    <div
                      className={`text-lg font-bold ${isTodayFlag ? 'text-primary' : ''}`}
                    >
                      {day.getDate()}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-none">
                      {day.toLocaleDateString('he-IL', { month: 'short' })}
                    </div>
                  </div>
                </div>
                {dayStops.length > 0 && (
                  <div className="mt-2 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3 w-3 text-primary/70" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {dayStops.length} עצירות
                      </span>
                    </div>
                    {onViewDayMap && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDayMap(dateStr)}
                        className="h-6 gap-1 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/30"
                        title="הצג את יום המסלול על המפה"
                      >
                        <MapIcon className="h-3 w-3" />
                        מפה
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Stop Cards — grouped by driver */}
              <div className="p-2 min-h-[180px] space-y-3">
                {dayDeliveries.length > 0 ? (
                  dayDeliveries.map((delivery) => {
                    const driverCfg = DRIVER_CONFIG[delivery.driver];
                    return (
                      <div key={delivery.id} className="space-y-1.5">
                        {/* Driver subheader */}
                        <div
                          className={`flex items-center justify-between rounded-md px-2 py-1 ${driverCfg.color}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Truck className="h-3 w-3 flex-shrink-0" />
                            <span className="text-[11px] font-semibold truncate">
                              {driverCfg.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold opacity-80">
                            {delivery.stops.length}
                          </span>
                        </div>
                        {/* Stops for this driver — sortable within group */}
                        <SortableContext
                          items={delivery.stops.map((s) => s.stopId)}
                          strategy={verticalListSortingStrategy}
                        >
                          {delivery.stops.map((stop) => (
                            <StopCard
                              key={stop.stopId}
                              stop={stop}
                              delivery={delivery}
                              onRemove={onRemoveOrder}
                              onResolve={onResolveStop}
                            />
                          ))}
                        </SortableContext>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
                    <Truck className="h-5 w-5 mb-1" />
                    <span className="text-xs">אין עצירות</span>
                  </div>
                )}
              </div>
            </DayDropZone>
          );
        })}
      </div>
    </div>
  );
}
