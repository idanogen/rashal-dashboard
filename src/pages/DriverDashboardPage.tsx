import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useArriveStop } from '@/hooks/useArriveStop';
import { useCurrentProfile } from '@/hooks/useProfile';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CoordinationStatusBadge } from '@/components/whatsapp/CoordinationStatusBadge';
import { ScheduleCoordinationDialog } from '@/components/whatsapp/ScheduleCoordinationDialog';
import { RouteMap } from '@/components/deliveries/RouteMap';
import { buildWazeUrl, buildTelUrl } from '@/lib/navigation';
import {
  MapPin,
  Phone,
  Navigation,
  Check,
  X,
  Clock,
  Truck,
  Package,
  Wrench,
  ClipboardList,
  Undo2,
  MessageCircle,
  Loader2,
  CalendarClock,
  ListChecks,
  Map as MapIcon,
} from 'lucide-react';
import type { CalendarStop as DbCalendarStop } from '@/types/calendar-stop';
import type { CalendarStop as UiCalendarStop } from '@/types/delivery';
import { OrderChatSheet } from '@/components/OrderChatSheet';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { DeliveryOutcomeDialog } from '@/components/DeliveryOutcomeDialog';
import { useCommentCounts } from '@/hooks/useTimeline';
import type { ChatSourceKind } from '@/lib/timeline';

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `יום ${dayNames[d.getDay()]}, ${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`;
}

function isResolved(status: DbCalendarStop['status']): boolean {
  return status === 'completed' || status === 'not_completed' || status === 'cancelled';
}

const SOURCE_CONFIG = {
  delivery: { Icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'משלוח' },
  service:  { Icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', label: 'שירות' },
  task:     { Icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', label: 'משימה' },
  pickup:   { Icon: Undo2, color: 'text-teal-600', bg: 'bg-teal-50', label: 'איסוף' },
} as const;

/** Convert a DB CalendarStop to the UI CalendarStop shape the dialog expects. */
function toUiStop(db: DbCalendarStop): UiCalendarStop {
  return {
    stopId: db.id,
    sourceId: db.orderId ?? db.serviceCallId ?? db.id,
    sourceType: db.sourceType,
    status: db.status,
    deliveryDate: db.deliveryDate,
    driver: db.driver,
    customerName: db.customerName,
    address: db.address,
    city: db.city,
    phone: db.phone,
    coordinationStatus: db.coordinationStatus,
    coordinationMethod: db.coordinationMethod,
    coordinatedAt: db.coordinatedAt,
    timeWindowStart: db.timeWindowStart,
    timeWindowEnd: db.timeWindowEnd,
  };
}

export function DriverDashboardPage() {
  const { data: profile } = useCurrentProfile();
  const { data: allStops, isLoading } = useCalendarStops();
  const resolveStop = useResolveStop();
  const arriveStop = useArriveStop();
  const log = useActivityLogger();
  const [coordinationStop, setCoordinationStop] = useState<UiCalendarStop | null>(null);
  const [notCompletedStop, setNotCompletedStop] = useState<DbCalendarStop | null>(null);
  const [showMap, setShowMap] = useState(true);

  /** הקשר אירוע אחיד לעצירה — לדוחות. */
  const stopCtx = (stop: DbCalendarStop) => ({
    entityType: 'calendar_stop' as const,
    entityId: stop.id,
    sourceType: stop.sourceType,
    customerName: stop.customerName,
  });

  // "לא בוצע" → פותח פופאפ לרישום סיבה; "סופק" → סימון מיידי (עם תוצאת אספקה אם משלוח).
  const handleResolve = (
    stop: DbCalendarStop,
    status: 'completed' | 'not_completed',
    notes?: string
  ) => {
    if (status === 'not_completed') {
      setNotCompletedStop(stop);
    } else {
      log('stop_completed', {
        ...stopCtx(stop),
        ...(notes ? { metadata: { deliveryOutcome: notes } } : {}),
      });
      resolveStop.mutate({ stop, status, notes });
    }
  };

  const handleCoordinate = (stop: DbCalendarStop) => {
    log('coordinate_open', stopCtx(stop));
    setCoordinationStop(toUiStop(stop));
  };

  // "הגעה" — מסמן שהנהג בנקודה (status → in_progress) + רישום ללוג.
  const handleArrive = (stop: DbCalendarStop) => {
    log('arrival', stopCtx(stop));
    arriveStop.mutate(stop.id);
  };

  const today = toLocalDateStr(new Date());
  const tomorrow = toLocalDateStr(new Date(Date.now() + 86_400_000));

  // RLS already filters to this driver's stops only. Group by date.
  const stopsByDate = useMemo(() => {
    const map = new Map<string, DbCalendarStop[]>();
    for (const s of allStops ?? []) {
      if (s.status === 'cancelled') continue;
      const list = map.get(s.deliveryDate) ?? [];
      list.push(s);
      map.set(s.deliveryDate, list);
    }
    // Sort each day by sequence
    for (const list of map.values()) {
      list.sort((a, b) => a.sequence - b.sequence);
    }
    return map;
  }, [allStops]);

  const todayStops = stopsByDate.get(today) ?? [];
  const tomorrowStops = stopsByDate.get(tomorrow) ?? [];
  const weekStops = useMemo(() => {
    const start = new Date();
    const end = new Date(Date.now() + 7 * 86_400_000);
    const result: { date: string; stops: DbCalendarStop[] }[] = [];
    for (const [date, stops] of stopsByDate.entries()) {
      const d = new Date(date + 'T00:00:00');
      if (d >= start && d <= end && date !== today && date !== tomorrow) {
        result.push({ date, stops });
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [stopsByDate, today, tomorrow]);

  // היסטוריית 7 הימים האחרונים (מאתמול אחורה), מהיום החדש לישן.
  const historyStops = useMemo(() => {
    const weekAgo = toLocalDateStr(new Date(Date.now() - 7 * 86_400_000));
    const result: { date: string; stops: DbCalendarStop[] }[] = [];
    for (const [date, stops] of stopsByDate.entries()) {
      if (date >= weekAgo && date < today) {
        result.push({ date, stops });
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [stopsByDate, today]);

  const historyCompleted = historyStops.reduce(
    (sum, d) => sum + d.stops.filter((s) => s.status === 'completed').length,
    0
  );
  const historyNotCompleted = historyStops.reduce(
    (sum, d) => sum + d.stops.filter((s) => s.status === 'not_completed').length,
    0
  );
  const historyTotal = historyStops.reduce((sum, d) => sum + d.stops.length, 0);

  const todayCompleted = todayStops.filter((s) => isResolved(s.status)).length;
  const todayRemaining = todayStops.length - todayCompleted;

  // UI-shaped stops for the map; next unresolved stop for the "navigate" button.
  const todayUiStops = useMemo(() => todayStops.map(toUiStop), [todayStops]);
  const nextStop = todayStops.find((s) => !isResolved(s.status));
  const nextWazeUrl = nextStop
    ? buildWazeUrl({
        address: nextStop.address
          ? `${nextStop.address}${nextStop.city ? `, ${nextStop.city}` : ''}`
          : nextStop.city ?? null,
        coordinates: nextStop.coordinates ?? null,
      })
    : null;

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100">
            <Truck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{dayLabel(today)}</p>
            <h1 className="text-lg font-bold leading-tight">
              שלום {profile?.fullName ?? profile?.username ?? 'נהג'} 👋
            </h1>
          </div>
        </div>
        {profile?.linkedDriver && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
            {profile.linkedDriver}
          </Badge>
        )}
      </div>

      {/* Today's summary */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">המסלול שלך היום</p>
              <p className="text-3xl font-bold">{todayStops.length}</p>
              <p className="text-xs text-muted-foreground">
                {todayStops.length === 0
                  ? 'אין עצירות'
                  : `${todayCompleted} בוצעו · ${todayRemaining} נותרו`}
              </p>
            </div>
            <ListChecks className="h-12 w-12 text-emerald-500/40" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="today" dir="rtl">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">
            היום
            {todayStops.length > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {todayRemaining}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="flex-1">
            מחר
            {tomorrowStops.length > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {tomorrowStops.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="week" className="flex-1">
            השבוע
            {weekStops.length > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {weekStops.reduce((sum, d) => sum + d.stops.length, 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            היסטוריה
            {historyTotal > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {historyTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3">
          {todayStops.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {nextWazeUrl && (
                  <a
                    href={nextWazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => nextStop && log('navigate', stopCtx(nextStop))}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-blue-700"
                  >
                    <Navigation className="h-4 w-4" />
                    נווט לעצירה הבאה{nextStop ? ` · ${nextStop.customerName}` : ''}
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMap((v) => !v)}
                  className="h-[42px] gap-1.5 text-xs"
                >
                  <MapIcon className="h-4 w-4" />
                  {showMap ? 'הסתר מפה' : 'הצג מפה'}
                </Button>
              </div>
              {showMap && <RouteMap stops={todayUiStops} height="300px" />}
            </div>
          )}
          {todayStops.length === 0 ? (
            <EmptyState message="אין עצירות מתוכננות להיום 🎉" />
          ) : (
            todayStops.map((stop, idx) => (
              <DriverStopCard
                key={stop.id}
                stop={stop}
                index={idx + 1}
                onCoordinate={() => handleCoordinate(stop)}
                onArrive={() => handleArrive(stop)}
                onResolve={(status, notes) => handleResolve(stop, status, notes)}
                resolving={resolveStop.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="tomorrow" className="space-y-3">
          {tomorrowStops.length === 0 ? (
            <EmptyState message="אין עצירות מתוכננות למחר" />
          ) : (
            tomorrowStops.map((stop, idx) => (
              <DriverStopCard
                key={stop.id}
                stop={stop}
                index={idx + 1}
                onCoordinate={() => handleCoordinate(stop)}
                onArrive={() => handleArrive(stop)}
                onResolve={(status, notes) => handleResolve(stop, status, notes)}
                resolving={resolveStop.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          {weekStops.length === 0 ? (
            <EmptyState message="אין עצירות נוספות בשבוע הקרוב" />
          ) : (
            weekStops.map((day) => (
              <div key={day.date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{dayLabel(day.date)}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {day.stops.length} עצירות
                  </Badge>
                </div>
                {day.stops.map((stop, idx) => (
                  <DriverStopCard
                    key={stop.id}
                    stop={stop}
                    index={idx + 1}
                    onCoordinate={() => handleCoordinate(stop)}
                    onArrive={() => handleArrive(stop)}
                    onResolve={(status, notes) => handleResolve(stop, status, notes)}
                    resolving={resolveStop.isPending}
                  />
                ))}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyStops.length === 0 ? (
            <EmptyState message="אין היסטוריה מהשבוע האחרון" />
          ) : (
            <>
              {/* סיכום שבועי — סופקו / לא בוצעו */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-emerald-200 bg-emerald-50/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{historyCompleted}</p>
                    <p className="text-[11px] text-muted-foreground">סופקו</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{historyNotCompleted}</p>
                    <p className="text-[11px] text-muted-foreground">לא בוצעו</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{historyTotal}</p>
                    <p className="text-[11px] text-muted-foreground">סה״כ עצירות</p>
                  </CardContent>
                </Card>
              </div>

              {historyStops.map((day) => (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{dayLabel(day.date)}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {day.stops.length} עצירות
                    </Badge>
                  </div>
                  {day.stops.map((stop, idx) => (
                    <DriverStopCard
                      key={stop.id}
                      stop={stop}
                      index={idx + 1}
                      onCoordinate={() => handleCoordinate(stop)}
                      onArrive={() => handleArrive(stop)}
                      onResolve={(status, notes) => handleResolve(stop, status, notes)}
                      resolving={resolveStop.isPending}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      <ScheduleCoordinationDialog
        stop={coordinationStop}
        open={!!coordinationStop}
        onOpenChange={(open) => {
          if (!open) setCoordinationStop(null);
        }}
      />

      <NotCompletedReasonDialog
        open={!!notCompletedStop}
        customerName={notCompletedStop?.customerName}
        submitting={resolveStop.isPending}
        onOpenChange={(open) => {
          if (!open) setNotCompletedStop(null);
        }}
        onConfirm={(reason) => {
          if (!notCompletedStop) return;
          log('stop_not_completed', {
            ...stopCtx(notCompletedStop),
            metadata: { reason },
          });
          resolveStop.mutate(
            { stop: notCompletedStop, status: 'not_completed', notes: reason },
            { onSuccess: () => setNotCompletedStop(null) }
          );
        }}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

/** Per-stop chat trigger, styled to match the mobile action row. Opens the
 *  internal per-record chat sheet (order or service call) with a comment-count badge. */
function StopChatButton({ stop, className = '' }: { stop: DbCalendarStop; className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: commentCounts = {} } = useCommentCounts();
  const chatId = stop.serviceCallId ?? stop.orderId ?? stop.id;
  const kind: ChatSourceKind = stop.sourceType === 'service' ? 'service' : 'order';
  const count = commentCounts[chatId] || 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`relative h-11 gap-1 text-xs ${className}`}
      >
        <MessageCircle className="h-4 w-4 text-primary" />
        צ'אט
        {count > 0 && (
          <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
            {count}
          </span>
        )}
      </Button>
      <OrderChatSheet
        order={{ id: chatId, customerName: stop.customerName, city: stop.city, kind }}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

interface DriverStopCardProps {
  stop: DbCalendarStop;
  index: number;
  onCoordinate: () => void;
  onArrive: () => void;
  onResolve: (status: 'completed' | 'not_completed', notes?: string) => void;
  resolving: boolean;
}

/** משך חלון ה"חשיבה" בין הגעה לסופק (מונע לחיצות רצופות). */
const ARRIVAL_THINK_MS = 10_000;

function DriverStopCard({ stop, index, onCoordinate, onArrive, onResolve, resolving }: DriverStopCardProps) {
  const log = useActivityLogger();
  const logStop = (action: string) =>
    log(action, {
      entityType: 'calendar_stop',
      entityId: stop.id,
      sourceType: stop.sourceType,
      customerName: stop.customerName,
    });
  const resolved = isResolved(stop.status);

  // חלון חשיבה של 10ש' אחרי לחיצה על "הגעה" — נועל את כל הכפתורים.
  const [thinking, setThinking] = useState(false);
  const [arrivedLocal, setArrivedLocal] = useState(false);
  // משלוח בלבד: בחירת תוצאת אספקה לפני סימון "סופק".
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const isDelivery = stop.sourceType === 'delivery';
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // הנהג סימן הגעה → ה-stop ב-in_progress (נשמר ב-DB ושורד רענון);
  // arrivedLocal מגבה את התצוגה אם ה-refetch מתעכב.
  const hasArrived = stop.status === 'in_progress' || arrivedLocal;

  const handleArriveClick = () => {
    if (thinking) return;
    setThinking(true);
    setArrivedLocal(true);
    onArrive();
    timerRef.current = setTimeout(() => setThinking(false), ARRIVAL_THINK_MS);
  };
  const isCustomerConfirmed = stop.coordinationStatus === 'customer_confirmed';
  const isCustomerRejected = stop.coordinationStatus === 'customer_rejected';
  const src = SOURCE_CONFIG[stop.sourceType] ?? SOURCE_CONFIG.delivery;
  const SrcIcon = src.Icon;

  const wazeUrl = buildWazeUrl({
    address: stop.address ? `${stop.address}${stop.city ? `, ${stop.city}` : ''}` : null,
    coordinates: stop.coordinates ?? null,
  });
  const telUrl = buildTelUrl(stop.phone);

  const bgClass = stop.status === 'completed'
    ? 'bg-emerald-50/70 border-emerald-200'
    : stop.status === 'not_completed'
      ? 'bg-red-50/60 border-red-200 opacity-75'
      : isCustomerConfirmed
        ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300/60'
        : isCustomerRejected
          ? 'bg-red-50/40 border-red-200'
          : 'bg-card';

  return (
    <>
    <Card className={`${bgClass} transition-all`}>
      <CardContent className="p-4 space-y-3">
        {/* Top row: stop number + source + name */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-base flex-shrink-0">
            {index}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`flex h-5 w-5 items-center justify-center rounded ${src.bg} ${src.color}`}>
                <SrcIcon className="h-3 w-3" />
              </span>
              <h2 className={`text-base font-bold leading-tight ${stop.status === 'not_completed' ? 'line-through text-muted-foreground' : ''}`}>
                {stop.customerName}
              </h2>
              {stop.status === 'completed' && (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                  ✓ בוצע
                </Badge>
              )}
              {stop.status === 'not_completed' && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px]">
                  ✗ לא בוצע
                </Badge>
              )}
            </div>
            {stop.coordinationStatus && (
              <div className="mt-1.5">
                <CoordinationStatusBadge status={stop.coordinationStatus} showLabel className="text-[11px]" />
              </div>
            )}
          </div>
        </div>

        {/* Address & time window */}
        {(stop.address || stop.city) && (
          <a
            href={wazeUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logStop('navigate')}
            className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate">
              {stop.address}
              {stop.city ? `, ${stop.city}` : ''}
            </span>
            <Navigation className="h-4 w-4 flex-shrink-0 text-blue-600" />
          </a>
        )}

        {stop.timeWindowStart && stop.timeWindowEnd && (
          <div className={`flex items-center gap-2 text-sm ${isCustomerConfirmed ? 'text-emerald-700 font-bold' : 'text-muted-foreground'}`}>
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span dir="ltr">
              {stop.timeWindowStart}–{stop.timeWindowEnd}
            </span>
          </div>
        )}

        {/* Phone */}
        {stop.phone && (
          <a
            href={telUrl ?? '#'}
            onClick={() => logStop('call')}
            className="flex items-center gap-2 text-sm text-emerald-700 hover:underline font-medium"
            dir="ltr"
          >
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>{stop.phone}</span>
          </a>
        )}

        {/* Notes (if any) */}
        {stop.notes && (
          <div className="text-xs text-muted-foreground italic bg-muted/40 rounded p-2">
            📝 {stop.notes}
          </div>
        )}

        {/* Action buttons */}
        {thinking ? (
          /* חלון חשיבה — 10 שניות, הכל נעול */
          <div className="pt-1">
            <div className="flex h-11 items-center justify-center gap-2 rounded-md bg-blue-50 text-sm font-medium text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              רושם הגעה…
            </div>
          </div>
        ) : !resolved ? (
          <div className="grid grid-cols-4 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onCoordinate}
              disabled={resolving}
              className="h-11 gap-1 text-xs"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              תיאום
            </Button>
            {hasArrived ? (
              /* שלב 2 — אחרי הגעה: "סופק" בצבע שונה (ירוק) */
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // משלוח → חובה לבחור תוצאת אספקה; אחרת סימון מיידי.
                  if (isDelivery) setOutcomeOpen(true);
                  else onResolve('completed');
                }}
                disabled={resolving}
                className="h-11 gap-1 text-xs bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                סופק
              </Button>
            ) : (
              /* שלב 1 — "הגעה" (כחול) */
              <Button
                variant="outline"
                size="sm"
                onClick={handleArriveClick}
                disabled={resolving}
                className="h-11 gap-1 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <MapPin className="h-4 w-4" />
                הגעה
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResolve('not_completed')}
              disabled={resolving}
              className="h-11 gap-1 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
              לא בוצע
            </Button>
            <StopChatButton stop={stop} />
          </div>
        ) : (
          <div className="pt-1">
            <StopChatButton stop={stop} className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>

    {/* משלוח בלבד — בחירת תוצאת אספקה לפני "סופק" */}
    <DeliveryOutcomeDialog
      open={outcomeOpen}
      customerName={stop.customerName}
      submitting={resolving}
      onOpenChange={setOutcomeOpen}
      onSelect={(outcome) => {
        setOutcomeOpen(false);
        onResolve('completed', outcome);
      }}
    />
    </>
  );
}
