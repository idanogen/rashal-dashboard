import { useState, useMemo } from 'react';
import type { CalendarDelivery, CalendarStop } from '@/types/delivery';
import { DRIVER_CONFIG } from '@/types/delivery';
import type { DriverName } from '@/types/route';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Truck,
  MapPin,
  Trash2,
  GripVertical,
  Phone,
  Map,
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

// פורמט תאריך מקומי (לא UTC) למניעת באגי timezone
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface DeliveryCalendarProps {
  deliveries: CalendarDelivery[];
  onRemoveOrder?: (deliveryId: string, orderId: string) => void;
  onViewDayRoute?: (dateStr: string) => void;
}

// ─── Stop Card ─────────────────────────────────────────────

interface StopCardProps {
  stop: CalendarStop;
  delivery: CalendarDelivery;
  onRemove?: (deliveryId: string, orderId: string) => void;
}

function StopCard({ stop, delivery, onRemove }: StopCardProps) {
  const config = DRIVER_CONFIG[delivery.driver];

  return (
    <div
      className={`
        group rounded-lg border-s-[3px] ${config.borderColor} border bg-background/60
        p-2 transition-all duration-200 hover:shadow-md
      `}
    >
      {/* Top row: customer name + driver badge + trash */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
          <span className="font-semibold text-xs truncate">
            {stop.customerName}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${config.color}`}
          >
            {config.label}
          </span>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(delivery.id, stop.orderId);
              }}
              className="h-5 w-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
              title="החזר לממתינות"
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
  onViewDayRoute,
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
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3 w-3 text-primary/70" />
                      <span className="text-xs text-muted-foreground font-medium">
                        {dayStops.length} הזמנות
                      </span>
                    </div>
                    {onViewDayRoute && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-primary/10"
                        onClick={() => onViewDayRoute(dateStr)}
                        title="צפה במסלולים על המפה"
                      >
                        <Map className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Stop Cards */}
              <div className="space-y-1.5 p-2 min-h-[180px]">
                {dayStops.length > 0 ? (
                  dayStops.map(({ stop, delivery }) => (
                    <StopCard
                      key={`${delivery.id}-${stop.orderId}`}
                      stop={stop}
                      delivery={delivery}
                      onRemove={onRemoveOrder}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
                    <Truck className="h-5 w-5 mb-1" />
                    <span className="text-xs">אין הזמנות</span>
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
