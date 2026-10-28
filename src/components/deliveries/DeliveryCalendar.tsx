import { useState, useMemo, useEffect } from 'react';
import type { CalendarDelivery, CalendarStop } from '@/types/delivery';
import { useAssignees } from '@/hooks/useAssignees';
import { RAIL_DAY_EVENT, railSetDays } from '@/lib/dispatch-rail-store';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import { useRailSection } from '@/hooks/useRailSection';
import { ScheduleCoordinationDialog } from '@/components/whatsapp/ScheduleCoordinationDialog';
import { StopCallInfoSheet } from '@/components/driver/StopCallInfoSheet';
import { useCallsWithDoc } from '@/hooks/useStopCallInfo';
import { useStopDocs } from '@/hooks/useStopDocs';
import { EditStopDetailsDialog } from '@/components/deliveries/EditStopDetailsDialog';
import { CalendarHeader } from '@/components/deliveries/CalendarHeader';
import { CalendarDayColumn } from '@/components/deliveries/CalendarDayColumn';
import { toLocalDateStr } from '@/lib/calendar-meta';

/**
 * היומן השבועי של הסדרן. פוצל ב-28/10/2026 (היה 1,057 שורות): הכרטיס ב-
 * `CalendarStopCard`, עמודת היום ב-`CalendarDayColumn`, הכותרת והמקרא ב-
 * `CalendarHeader`, המטא ב-`lib/calendar-meta.ts`. כאן נשארו המצב והחיווט.
 */
interface DeliveryCalendarProps {
  deliveries: CalendarDelivery[];
  /** Called with the calendar_stops.id to remove (single source of truth) */
  onRemoveOrder?: (stopId: string) => void;
  /** Called when user clicks "+" on a day to create a free-standing task */
  onAddTask?: (dateStr: string) => void;
  /** Called to mark a stop as completed / not_completed */
  onResolveStop?: (stopId: string, status: 'completed' | 'not_completed') => void;
  /** Called to move a resolved (not_completed) stop to another day — opens date+worker picker */
  onMoveStop?: (stopId: string) => void;
  /** Called when user clicks "map" on a day to see the full day's route */
  onViewDayMap?: (dateStr: string) => void;
  /**
   * כמה עצירות מוסתרות בכל יום בגלל סינון הסוגים (מפתח = תאריך).
   * בלי זה יום ריק נראה זהה ליום שכולו מסונן, והמשתמש מסיק שהמידע נעלם.
   */
  hiddenByFilter?: Record<string, number>;
  /** מחזיר את סינון הסוגים להצגת הכל */
  onShowAllTypes?: () => void;
}

// ─── Stop Card ─────────────────────────────────────────────

// ─── Calendar Component ─────────────────────────────────────

export function DeliveryCalendar({
  deliveries,
  onRemoveOrder,
  onAddTask,
  onResolveStop,
  onViewDayMap,
  onMoveStop,
  hiddenByFilter,
  onShowAllTypes,
}: DeliveryCalendarProps) {
  // סדר תצוגה אחיד של המשובצים, מטבלת הצוות ולא מרשימה בקוד.
  const { order: assigneeOrder } = useAssignees();
  const [currentDate, setCurrentDate] = useState(new Date());
  /** ימי עבר מוצגים כעמודה צרה. לחיצה פותחת יום מסוים לרוחב מלא. */
  const [expandedPastDays, setExpandedPastDays] = useState<Set<string>>(new Set());
  const togglePastDay = (dateStr: string) =>
    setExpandedPastDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  const [coordinationStop, setCoordinationStop] = useState<CalendarStop | null>(null);
  const [infoStop, setInfoStop] = useState<CalendarStop | null>(null);
  const [editStop, setEditStop] = useState<CalendarStop | null>(null);
  // קבוצות נהג מקופלות ביומן (key = delivery.id = "date__driver").
  // ⭐ עידן, 06/09/2026: "כווץ הכל / פתח הכל" גם ביומן, שמשפיע על כל הנהגים.
  // ברירת המחדל (הכל מכווץ או הכל פתוח) נזכרת לכל משתמש; לחיצה על נהג
  // בודד היא חריגה ממנה, ו"כווץ הכל" הבא מנקה את החריגות.
  const [groupsAllCollapsed, toggleGroupsAll] = usePersistedCollapse('collapse:calendar-groups');
  const [groupOverrides, setGroupOverrides] = useState<Set<string>>(new Set());
  const isGroupCollapsed = (id: string) =>
    groupsAllCollapsed ? !groupOverrides.has(id) : groupOverrides.has(id);
  const toggleGroup = (id: string) =>
    setGroupOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllGroups = () => { setGroupOverrides(new Set()); toggleGroupsAll(); };
  // במסילת הניווט: החץ של "היומן" מכווץ ופותח את כל הנהגים.
  useRailSection({
    id: 'calendar', title: 'היומן', order: 90, tone: 'emerald', icon: 'calendar', count: null,
    collapsed: groupsAllCollapsed, toggle: toggleAllGroups,
  });

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

  // היומן מציג תמיד את שבוע העבודה המלא לפי הסדר. ימי עבר מקבלים עמודה
  // צרה עם מונה בלבד, כדי שהסדר לא יישבר ושהיום לא ייקבר מתחתיהם.
  const visibleDays = useMemo(() => {
    return getWeekWorkDays(currentDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, todayStr]);

  // ── חיווי מסמכים מצורפים: רק לשבוע שעל המסך ──
  // 🔴 21/10/2026: הרשימה נבנתה מכל העצירות מכל הזמנים ונחתכה ל-300 לפי
  // מזהה. ב-798 קריאות משובצות, רוב הקריאות של השבוע נפלו מחוץ לחתך
  // ו"📄 טופס" לא הופיע עליהן.
  const weekStops = useMemo(() => {
    const days = new Set(visibleDays.map((d) => toLocalDateStr(d)));
    return deliveries.filter((d) => days.has(d.date)).flatMap((d) => d.stops);
  }, [deliveries, visibleDays]);
  const serviceCallIds = useMemo(
    () => weekStops.filter((st) => st.sourceType === 'service' && st.sourceId && st.sourceId !== st.stopId).map((st) => st.sourceId!),
    [weekStops]
  );
  const { data: docsByCall } = useCallsWithDoc(serviceCallIds);
  const { data: docsByStop } = useStopDocs(useMemo(() => weekStops.map((st) => st.stopId), [weekStops]));

  // כל יום שעבר מכווץ כברירת מחדל, גם בשבוע שכולו בעבר. אחרת חמש עמודות
  // רחבות לא נכנסות לרוחב המסך, ויום חמישי נדחף לשורה שנייה מתחת לקפל.
  // כך כל חמשת ימי העבודה תמיד נראים, לפי הסדר, ולחיצה פותחת את מה שצריך.
  // ── מסילת הניווט: ימי השבוע עם ספירה, וקפיצה לעמודת יום (06/09/2026) ──
  useEffect(() => {
    railSetDays(visibleDays.map((day) => {
      const ds = toLocalDateStr(day);
      return {
        date: ds,
        label: `${dayNames[day.getDay()]} ${day.getDate()}/${day.getMonth() + 1}`,
        count: getStopsForDate(ds).length,
        isToday: ds === todayStr,
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDays, deliveries, todayStr]);
  useEffect(() => () => railSetDays([]), []);
  useEffect(() => {
    const onJump = (e: Event) => {
      const date = (e as CustomEvent<{ date: string }>).detail?.date;
      if (!date) return;
      const inWeek = visibleDays.some((d) => toLocalDateStr(d) === date);
      if (!inWeek) setCurrentDate(new Date(date + 'T12:00:00'));
      // אחרי הגלילה האנכית של המסילה, העמודה מובאת לתצוגה אופקית ומהבהבת.
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-rail-day="${date}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        el.classList.add('ring-4', 'ring-emerald-400');
        setTimeout(() => el.classList.remove('ring-4', 'ring-emerald-400'), 1400);
      }, 450);
    };
    window.addEventListener(RAIL_DAY_EVENT, onJump);
    return () => window.removeEventListener(RAIL_DAY_EVENT, onJump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDays]);

  const isCollapsedDay = (day: Date) =>
    isPastDay(day) && !expandedPastDays.has(toLocalDateStr(day));

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


  return (
    <div className="space-y-4">
      <CalendarHeader
        monthLabel={formatMonthYear()}
        groupsAllCollapsed={groupsAllCollapsed}
        onToggleAllGroups={toggleAllGroups}
        onToday={goToToday}
        onPrevWeek={goToPreviousWeek}
        onNextWeek={goToNextWeek}
      />

      {/* Week Grid */}
      {/* גלישה תמיד. בלי זה שבוע שכולו בעבר פותח חמש עמודות רחבות
          בשורה אחת ומייצר גלילה אופקית. */}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
        {visibleDays.map((day) => {
          const dateStr = toLocalDateStr(day);
          return (
            <CalendarDayColumn
              key={day.toISOString()}
              day={day}
              dayNames={dayNames}
              dayStops={getStopsForDate(dateStr)}
              dayDeliveries={getDeliveriesForDate(dateStr).sort(
                (a, b) => assigneeOrder.indexOf(a.driver) - assigneeOrder.indexOf(b.driver)
              )}
              isTodayFlag={isToday(day)}
              isPast={isPastDay(day)}
              collapsed={isCollapsedDay(day)}
              hiddenCount={hiddenByFilter?.[dateStr] ?? 0}
              togglePastDay={togglePastDay}
              isGroupCollapsed={isGroupCollapsed}
              toggleGroup={toggleGroup}
              onAddTask={onAddTask}
              onViewDayMap={onViewDayMap}
              onShowAllTypes={onShowAllTypes}
              onRemoveOrder={onRemoveOrder}
              onResolveStop={onResolveStop}
              onMoveStop={onMoveStop}
              setCoordinationStop={setCoordinationStop}
              setInfoStop={setInfoStop}
              setEditStop={setEditStop}
              docsByCall={docsByCall}
              docsByStop={docsByStop}
            />
          );
        })}
      </div>

      {/* Coordination dialog — opens when a card's "תיאום" button is clicked */}
      <ScheduleCoordinationDialog
        stop={coordinationStop}
        open={!!coordinationStop}
        onOpenChange={(open) => {
          if (!open) setCoordinationStop(null);
        }}
      />

      {/* כרטיס הקריאה — נפתח בלחיצה על כרטיס שירות */}
      <EditStopDetailsDialog
        stop={editStop}
        open={!!editStop}
        onOpenChange={(open) => {
          if (!open) setEditStop(null);
        }}
      />
      <StopCallInfoSheet
        calendarStop={infoStop ?? undefined}
        open={!!infoStop}
        onOpenChange={(open) => {
          if (!open) setInfoStop(null);
        }}
      />
    </div>
  );
}
