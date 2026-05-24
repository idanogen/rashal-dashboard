import { useMemo, useState } from 'react';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useCurrentProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CoordinationStatusBadge } from '@/components/whatsapp/CoordinationStatusBadge';
import { ScheduleCoordinationDialog } from '@/components/whatsapp/ScheduleCoordinationDialog';
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
  MessageCircle,
  Loader2,
  CalendarClock,
  ListChecks,
} from 'lucide-react';
import type { CalendarStop as DbCalendarStop } from '@/types/calendar-stop';
import type { CalendarStop as UiCalendarStop } from '@/types/delivery';

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
  const [coordinationStop, setCoordinationStop] = useState<UiCalendarStop | null>(null);

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

  const todayCompleted = todayStops.filter((s) => isResolved(s.status)).length;
  const todayRemaining = todayStops.length - todayCompleted;

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
              שלום {profile?.fullName ?? profile?.email ?? 'נהג'} 👋
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
        </TabsList>

        <TabsContent value="today" className="space-y-3">
          {todayStops.length === 0 ? (
            <EmptyState message="אין עצירות מתוכננות להיום 🎉" />
          ) : (
            todayStops.map((stop, idx) => (
              <DriverStopCard
                key={stop.id}
                stop={stop}
                index={idx + 1}
                onCoordinate={() => setCoordinationStop(toUiStop(stop))}
                onResolve={(status) => resolveStop.mutate({ stop, status })}
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
                onCoordinate={() => setCoordinationStop(toUiStop(stop))}
                onResolve={(status) => resolveStop.mutate({ stop, status })}
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
                    onCoordinate={() => setCoordinationStop(toUiStop(stop))}
                    onResolve={(status) => resolveStop.mutate({ stop, status })}
                    resolving={resolveStop.isPending}
                  />
                ))}
              </div>
            ))
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

interface DriverStopCardProps {
  stop: DbCalendarStop;
  index: number;
  onCoordinate: () => void;
  onResolve: (status: 'completed' | 'not_completed') => void;
  resolving: boolean;
}

function DriverStopCard({ stop, index, onCoordinate, onResolve, resolving }: DriverStopCardProps) {
  const resolved = isResolved(stop.status);
  const isCustomerConfirmed = stop.coordinationStatus === 'customer_confirmed';
  const isCustomerRejected = stop.coordinationStatus === 'customer_rejected';
  const src = SOURCE_CONFIG[stop.sourceType] ?? SOURCE_CONFIG.delivery;
  const SrcIcon = src.Icon;

  const wazeUrl = buildWazeUrl({ address: stop.address ? `${stop.address}${stop.city ? `, ${stop.city}` : ''}` : null });
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
        {!resolved && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onCoordinate}
              className="h-11 gap-1 text-xs"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              תיאום
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResolve('completed')}
              disabled={resolving}
              className="h-11 gap-1 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
            >
              <Check className="h-4 w-4" />
              בוצע
            </Button>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
