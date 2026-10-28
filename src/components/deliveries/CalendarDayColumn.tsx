import { ChevronDown, ChevronLeft, ChevronRight, EyeOff, Map as MapIcon, Plus, Truck } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import type { CalendarDelivery, CalendarStop } from '@/types/delivery';
import { assigneeStyle } from '@/types/delivery';
import { compareStopsByTime } from '@/lib/stop-order';
import type { StopDocState } from '@/hooks/useStopDocs';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { CalendarDayDropZone } from '@/components/deliveries/CalendarDayDropZone';
import { CalendarStopCard } from '@/components/deliveries/CalendarStopCard';

/**
 * עמודת יום ביומן: יום שעבר מכווץ כפס צר, אחרת כותרת היום, קבוצות הנהגים
 * וכרטיסי העצירות. הוצא מ-`DeliveryCalendar.tsx` ב-28/10/2026, הקוד כמו שהיה.
 */
export interface CalendarDayColumnProps {
  day: Date;
  dayNames: string[];
  dayStops: { stop: CalendarStop; delivery: CalendarDelivery }[];
  dayDeliveries: CalendarDelivery[];
  isTodayFlag: boolean;
  isPast: boolean;
  collapsed: boolean;
  hiddenCount: number;
  togglePastDay: (dateStr: string) => void;
  isGroupCollapsed: (id: string) => boolean;
  toggleGroup: (id: string) => void;
  onAddTask?: (dateStr: string) => void;
  onViewDayMap?: (dateStr: string) => void;
  onShowAllTypes?: () => void;
  onRemoveOrder?: (stopId: string) => void;
  onResolveStop?: (stopId: string, status: 'completed' | 'not_completed') => void;
  onMoveStop?: (stopId: string) => void;
  setCoordinationStop: (stop: CalendarStop) => void;
  setInfoStop: (stop: CalendarStop) => void;
  setEditStop: (stop: CalendarStop) => void;
  docsByCall?: Record<string, unknown>;
  docsByStop?: Record<string, StopDocState>;
}

export function CalendarDayColumn({
  day, dayNames, dayStops, dayDeliveries, isTodayFlag, isPast, collapsed, hiddenCount,
  togglePastDay, isGroupCollapsed, toggleGroup, onAddTask, onViewDayMap, onShowAllTypes,
  onRemoveOrder, onResolveStop, onMoveStop, setCoordinationStop, setInfoStop, setEditStop, docsByCall, docsByStop,
}: CalendarDayColumnProps) {
  const dateStr = toLocalDateStr(day);

  // יום שעבר מוצג כעמודה צרה: שם היום, תאריך, ומונה. לחיצה פותחת.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => togglePastDay(dateStr)}
        title={`הצג את ${dayNames[day.getDay()]} ${day.getDate()}`}
        className="flex w-full flex-row items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-500/5 px-3 py-2
          text-amber-800 transition-colors hover:bg-amber-500/10
          md:w-[92px] md:flex-none md:flex-col md:justify-start md:py-3"
      >
        <span className="text-xs font-semibold">{dayNames[day.getDay()]}</span>
        <span className="text-lg font-bold leading-none">{day.getDate()}</span>
        <span className="text-[10px] opacity-70">
          {day.toLocaleDateString('he-IL', { month: 'short' })}
        </span>
        {dayStops.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold">
            {dayStops.length}
          </span>
        ) : (
          <span className="text-[10px] opacity-50">ריק</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
    );
  }

  return (
    <CalendarDayDropZone
      date={day}
      isToday={isTodayFlag}
      isPast={isPast}
      widthClass="w-full md:min-w-[240px] md:flex-1"
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
            {isPast && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md hover:bg-amber-100"
                onClick={() => togglePastDay(dateStr)}
                title="כווץ את היום"
              >
                <ChevronRight className="h-3.5 w-3.5 text-amber-600" />
              </Button>
            )}
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
            const driverCfg = assigneeStyle(delivery.driver);
            // סדר קנוני משותף לכל המסכים: שעת תיאום ראשי, sequence שובר-שוויון.
            const sortedStops = [...delivery.stops].sort(compareStopsByTime);
            const isCollapsed = isGroupCollapsed(delivery.id);
            return (
              <div key={delivery.id} className="space-y-1.5">
                {/* Driver subheader — לחיצה מקפלת/פותחת את כל העצירות שתחתיו */}
                <button
                  type="button"
                  onClick={() => toggleGroup(delivery.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 transition hover:brightness-95 ${driverCfg.color}`}
                  title={isCollapsed ? 'הצג עצירות' : 'קפל עצירות'}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isCollapsed ? (
                      <ChevronLeft className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    )}
                    <Truck className="h-3 w-3 flex-shrink-0" />
                    <span className="text-[11px] font-semibold truncate">
                      {driverCfg.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold opacity-80">
                    {delivery.stops.length}
                  </span>
                </button>
                {/* Stops for this driver — sorted by coordination time */}
                {!isCollapsed && (
                  <SortableContext
                    items={sortedStops.map((s) => s.stopId)}
                    strategy={verticalListSortingStrategy}
                  >
                    {sortedStops.map((stop) => (
                      <CalendarStopCard
                        key={stop.stopId}
                        stop={stop}
                        delivery={delivery}
                        onRemove={onRemoveOrder}
                        onResolve={onResolveStop}
                        onCoordinate={setCoordinationStop}
                        onMoveStop={onMoveStop}
                        onOpenInfo={setInfoStop}
                        onEditDetails={setEditStop}
                        hasDoc={stop.sourceType === 'service' && !!stop.sourceId && !!docsByCall?.[stop.sourceId]}
                        docs={docsByStop?.[stop.stopId]}
                      />
                    ))}
                  </SortableContext>
                )}
              </div>
            );
          })
        ) : hiddenCount > 0 ? (
          // היום לא ריק, הוא מסונן. בלי החיווי הזה נראה כאילו הנתונים נעלמו.
          <div className="flex flex-col items-center justify-center h-32 gap-1.5 px-2 text-center">
            <EyeOff className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-medium text-amber-700">
              {hiddenCount} עצירות מוסתרות בסינון
            </span>
            {onShowAllTypes && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShowAllTypes}
                className="h-7 rounded-md border-amber-300 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
              >
                הצג הכל
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
            <Truck className="h-5 w-5 mb-1" />
            <span className="text-xs">אין עצירות</span>
          </div>
        )}

        {/* ליום שיש בו גם עצירות גלויות וגם מוסתרות */}
        {dayDeliveries.length > 0 && hiddenCount > 0 && (
          <button
            type="button"
            onClick={onShowAllTypes}
            className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
          >
            <EyeOff className="h-3 w-3" />
            ועוד {hiddenCount} מוסתרות בסינון
          </button>
        )}
      </div>
    </CalendarDayDropZone>
  );
}
