import { useMemo, useState } from 'react';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { assigneeStyle } from '@/types/delivery';
import { ASSIGNEES, type AssigneeName } from '@/types/route';
import type { CalendarStop, StopSourceType } from '@/types/calendar-stop';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Wrench,
  Undo2,
  ClipboardList,
  MapPin,
  Clock,
  Phone,
  CalendarClock,
  Loader2,
  CalendarDays,
} from 'lucide-react';

// מטא-דאטה לכל סוג עצירה — אייקון, צבע, תווית.
const SOURCE_META: Record<
  StopSourceType,
  { Icon: typeof Package; color: string; bg: string; label: string }
> = {
  delivery: { Icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'משלוח' },
  service: { Icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', label: 'שירות' },
  pickup: { Icon: Undo2, color: 'text-teal-600', bg: 'bg-teal-50', label: 'איסוף' },
  task: { Icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', label: 'משימה' },
};
const SOURCE_ORDER: StopSourceType[] = ['delivery', 'service', 'pickup', 'task'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `יום ${dayNames[d.getDay()]}, ${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`;
}

type AssigneeFilter = AssigneeName | 'all';
type TypeFilter = StopSourceType | 'all';

export function ScheduledOverview() {
  const { data: allStops = [], isLoading } = useCalendarStops();
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const today = toLocalDateStr(new Date());

  // עצירות פעילות מהיום והלאה (planned + in_progress), אחרי הפילטרים.
  const filtered = useMemo(() => {
    return allStops.filter((s) => {
      if (s.status !== 'planned' && s.status !== 'in_progress') return false;
      if (s.deliveryDate < today) return false;
      if (assigneeFilter !== 'all' && s.driver !== assigneeFilter) return false;
      if (typeFilter !== 'all' && s.sourceType !== typeFilter) return false;
      return true;
    });
  }, [allStops, today, assigneeFilter, typeFilter]);

  // קיבוץ לפי יום → בתוך יום לפי עובד, ממוין לפי sequence.
  const days = useMemo(() => {
    const byDate = new Map<string, CalendarStop[]>();
    for (const s of filtered) {
      const list = byDate.get(s.deliveryDate) ?? [];
      list.push(s);
      byDate.set(s.deliveryDate, list);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stops]) => {
        const byAssignee = new Map<string, CalendarStop[]>();
        for (const s of stops) {
          const list = byAssignee.get(s.driver) ?? [];
          list.push(s);
          byAssignee.set(s.driver, list);
        }
        const groups = Array.from(byAssignee.entries())
          .sort(
            (a, b) => ASSIGNEES.indexOf(a[0] as AssigneeName) - ASSIGNEES.indexOf(b[0] as AssigneeName)
          )
          .map(([driver, list]) => ({
            driver,
            stops: list.sort((a, b) => a.sequence - b.sequence),
          }));
        return { date, count: stops.length, groups };
      });
  }, [filtered]);

  // ספירות לפי סוג — לתגיות הפילטר.
  const typeCounts = useMemo(() => {
    const active = allStops.filter(
      (s) =>
        (s.status === 'planned' || s.status === 'in_progress') && s.deliveryDate >= today
    );
    const counts: Record<TypeFilter, number> = { all: active.length, delivery: 0, service: 0, pickup: 0, task: 0 };
    for (const s of active) counts[s.sourceType]++;
    return counts;
  }, [allStops, today]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* פילטר סוג */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={typeFilter === 'all'}
          onClick={() => setTypeFilter('all')}
          label="הכל"
          count={typeCounts.all}
        />
        {SOURCE_ORDER.map((t) => {
          const meta = SOURCE_META[t];
          const Icon = meta.Icon;
          return (
            <FilterChip
              key={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              label={meta.label}
              count={typeCounts[t]}
              icon={<Icon className={`h-3.5 w-3.5 ${meta.color}`} />}
            />
          );
        })}
      </div>

      {/* פילטר עובד */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={assigneeFilter === 'all'}
          onClick={() => setAssigneeFilter('all')}
          label="כל העובדים"
        />
        {ASSIGNEES.map((name) => {
          const style = assigneeStyle(name);
          return (
            <button
              key={name}
              onClick={() => setAssigneeFilter(name)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                assigneeFilter === name
                  ? `${style.color} border-transparent ring-2 ring-offset-1 ring-current/30`
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${style.badgeColor}`} />
              {name}
            </button>
          );
        })}
      </div>

      {/* רשימת ימים */}
      {days.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarDays className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">אין עבודות משובצות בטווח הזה</p>
          </CardContent>
        </Card>
      ) : (
        days.map((day) => (
          <div key={day.date} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold">{dayLabel(day.date)}</h3>
              <Badge variant="outline" className="text-[10px]">
                {day.count} עצירות
              </Badge>
            </div>
            {day.groups.map((group) => {
              const style = assigneeStyle(group.driver);
              return (
                <div key={group.driver} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.badgeColor}`} />
                    <span className="text-xs font-semibold">{group.driver}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {group.stops.length} עצירות
                    </span>
                  </div>
                  {group.stops.map((stop) => (
                    <StopRow key={stop.id} stop={stop} borderColor={style.borderColor} />
                  ))}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
        active
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-background text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
      {typeof count === 'number' && (
        <span
          className={`rounded-full px-1.5 text-[10px] ${
            active ? 'bg-primary-foreground/20' : 'bg-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StopRow({ stop, borderColor }: { stop: CalendarStop; borderColor: string }) {
  const meta = SOURCE_META[stop.sourceType] ?? SOURCE_META.delivery;
  const Icon = meta.Icon;
  return (
    <Card className={`border-s-4 ${borderColor}`}>
      <CardContent className="flex items-start gap-3 p-3">
        <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded ${meta.bg} ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{stop.customerName}</span>
            <Badge variant="outline" className="flex-shrink-0 text-[10px]">
              {meta.label}
            </Badge>
            {stop.status === 'in_progress' && (
              <Badge variant="outline" className="flex-shrink-0 border-blue-300 bg-blue-50 text-[10px] text-blue-700">
                בדרך
              </Badge>
            )}
          </div>
          {(stop.address || stop.city) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {stop.address}
                {stop.address && stop.city ? ', ' : ''}
                {stop.city}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {stop.timeWindowStart && stop.timeWindowEnd && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span dir="ltr">
                  {stop.timeWindowStart}–{stop.timeWindowEnd}
                </span>
              </span>
            )}
            {stop.phone && (
              <span className="flex items-center gap-1" dir="ltr">
                <Phone className="h-3.5 w-3.5" />
                {stop.phone}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
