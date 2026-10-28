import { Calendar, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SOURCE_META, SOURCE_ORDER } from '@/lib/calendar-meta';

/** כותרת היומן (חודש, ניווט שבועות, כווץ הכל) והמקרא. הוצא מ-`DeliveryCalendar.tsx` ב-28/10/2026. */
export function CalendarHeader({ monthLabel, groupsAllCollapsed, onToggleAllGroups, onToday, onPrevWeek, onNextWeek }: {
  monthLabel: string;
  groupsAllCollapsed: boolean;
  onToggleAllGroups: () => void;
  onToday: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{monthLabel}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="rounded-lg font-medium"
          >
            היום
          </Button>
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAllGroups}
              className="h-8 gap-1 px-2 text-xs"
              title={groupsAllCollapsed ? 'פתח את כל הנהגים בכל הימים' : 'כווץ את כל הנהגים בכל הימים'}
            >
              {groupsAllCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
              {groupsAllCollapsed ? 'פתח הכל' : 'כווץ הכל'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevWeek}
              className="h-8 w-8 rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextWeek}
              className="h-8 w-8 rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* מקרא — סוגי העצירות ביומן */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-3 py-2">
        <span className="text-xs font-bold text-muted-foreground">מקרא</span>
        {SOURCE_ORDER.map((t) => {
          const m = SOURCE_META[t];
          const Icon = m.Icon;
          return (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`h-4 w-1.5 rounded-full ${m.dot}`} />
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${m.bg} ${m.color}`}>
                <Icon className="h-3 w-3" />
              </span>
              <span className="text-xs font-medium">{m.label}</span>
            </span>
          );
        })}
      </div>
    </>
  );
}
