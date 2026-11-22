import { useState } from 'react';
import { Archive, ListChecks, Package, Search, Undo2, UserPlus, Wrench, X } from 'lucide-react';

import { ActiveFiltersBanner } from '@/components/dispatch/ActiveFiltersBanner';
import { CalendarTypeChips } from '@/components/dispatch/CalendarTypeChips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SOURCE_TYPE_LABEL } from '@/hooks/useCalendarTypeFilter';
import { activeFilters, defaultHidings, filterSummary, type DefaultKey, type FilterKey, type FilterState } from '@/lib/active-filters';
import type { CalendarStopSource } from '@/types/delivery';

/**
 * ?view=filters: פס "המסך מסונן" (22/11/2026), לפני ואחרי, בלי התחברות.
 * "לפני" הוא העתק של הסימון הישן (צ'יפ קופה ו"נקה סינון" בשורת החיפוש).
 * `?state=clean` מצלם את המצב בלי סינון, `?only=after` רק את החדש.
 */
const COUNTS = { delivery: 61, service: 148, pickup: 37, task: 9, customer: 22 };
const TABS = [
  { label: 'הכל', Icon: ListChecks, n: 1540 },
  { label: 'משלוחים', Icon: Package, n: 412 },
  { label: 'קריאות שירות', Icon: Wrench, n: 655 },
  { label: 'איסופים', Icon: Undo2, n: 398 },
  { label: 'לקוחות חדשים', Icon: UserPlus, n: 75 },
];

function TabsRow() {
  return (
    <>
      <div className="flex h-11 items-center gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t, i) => (
          <span
            key={t.label}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm ${i === 0 ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{t.n}</Badge>
          </span>
        ))}
      </div>
      <span className="ms-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground">
        <Archive className="h-4 w-4" />
        ארכיון
      </span>
    </>
  );
}

function SearchRow({ old }: { old: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input readOnly value="" placeholder="חיפוש בכל השדות: שם, מספר לקוח, טלפון, כתובת" className="h-9 pr-9" />
      </div>
      {old && (
        <>
          <Button variant="outline" size="sm" className="h-7 gap-1 rounded-full text-xs">
            קופה: מכבי
            <X className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="secondary" className="h-7 px-2 text-xs">212 מתוך 212</Badge>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <X className="h-3.5 w-3.5" />
            נקה סינון
          </Button>
        </>
      )}
    </div>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">{children}</div>
    </section>
  );
}

const TYPES: CalendarStopSource[] = ['delivery', 'service', 'pickup', 'task', 'customer'];
const PLACEHOLDER = 'h-16 rounded-lg border border-dashed text-center text-xs leading-[4rem] text-muted-foreground';
const CLEARED: Record<FilterKey, Partial<FilterState>> = {
  fund: { fundLabel: null },
  lights: { lightLabels: [] },
  collapsed: { collapsedLabels: [] },
  types: { hiddenTypeLabels: [] },
  zones: { zoneLabels: [] },
  search: { search: '' },
  calendarSearch: { calendarSearch: '' },
};
const BEFORE_TITLE = 'באוויר מהבוקר: רק קופה, אזור, סוגים וחיפוש; הרמזור וברירות המחדל לא מופיעים';
const CLEAN_TITLE = 'בלי סינון של המשתמש: נשארת שורה אפורה דקה עם מה שמוסתר כברירת מחדל';
const AFTER_TITLE = 'אחרי: כל מה שמסנן (צהוב) וכל מה שמוסתר כברירת מחדל (אפור), בפס אחד';
// המצב מהצילום של עמי 22/11: כללית, קריות, וירוק ברמזור. המספרים להמחשה.
const FILTERED: FilterState = {
  search: '', zoneLabels: ['קריות'], fundLabel: 'כללית', hiddenTypeLabels: [], calendarSearch: '',
  lightLabels: ['מוכנות לשיבוץ'], collapsedLabels: ['נהגים ביומן'], defaultsOn: [],
};
const CLEAN: FilterState = {
  search: '', zoneLabels: [], fundLabel: null, hiddenTypeLabels: [], calendarSearch: '', lightLabels: [], collapsedLabels: [], defaultsOn: [],
};
const DEFAULT_COUNTS = { withOrder: 58, oldRed: 16, duplicates: 12 };

export function FiltersScene() {
  const params = new URLSearchParams(location.search);
  const [state, setState] = useState<FilterState>(params.get('state') === 'clean' ? CLEAN : FILTERED);
  const visible = new Set<CalendarStopSource>(TYPES.filter((t) => !state.hiddenTypeLabels.includes(SOURCE_TYPE_LABEL[t])));
  const filters = activeFilters(state);
  const summary = filterSummary(filters, { pendingShown: 25, pendingTotal: 2086, calendarHidden: 35 });
  const [shownDefaults, setShownDefaults] = useState<DefaultKey[]>([]);
  const defaults = defaultHidings(
    Object.fromEntries(Object.entries(DEFAULT_COUNTS).filter(([k]) => !shownDefaults.includes(k as DefaultKey)))
  );
  const clear = (key: FilterKey) => setState((s) => ({ ...s, ...CLEARED[key] }));
  const liveFilters = activeFilters({ ...FILTERED, lightLabels: [], collapsedLabels: [] });
  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {params.get('only') !== 'after' && (
          <Frame title={BEFORE_TITLE}>
            <div className="flex flex-wrap items-center border-b px-4 py-2">
              <TabsRow />
              <ActiveFiltersBanner
                filters={liveFilters}
                summary={filterSummary(liveFilters, { pendingShown: 25, pendingTotal: 2086, calendarHidden: 35 })}
                defaults={[]}
                onClear={() => undefined}
                onClearAll={() => undefined}
                onShowDefault={() => undefined}
              />
            </div>
            <div className="space-y-4 p-4">
              <SearchRow old={false} />
              <div className={PLACEHOLDER}>רשימות הממתינים (הרמזור מסנן ירוק, ולא רואים את זה בפס)</div>
            </div>
          </Frame>
        )}
        <Frame title={filters.length ? AFTER_TITLE : CLEAN_TITLE}>
          <div className="flex flex-wrap items-center border-b px-4 py-2">
            <TabsRow />
            <ActiveFiltersBanner
              filters={filters}
              summary={summary}
              defaults={defaults}
              onClear={clear}
              onClearAll={() => setState(CLEAN)}
              onShowDefault={(k) => setShownDefaults((p) => [...p, k])}
            />
          </div>
          <div className="space-y-4 p-4">
            <SearchRow old={false} />
            <div className={PLACEHOLDER}>רשימות הממתינים</div>
            <CalendarTypeChips visibleTypes={visible} counts={COUNTS} onToggle={() => undefined} onShowAll={() => clear('types')} />
          </div>
        </Frame>
      </div>
    </div>
  );
}
