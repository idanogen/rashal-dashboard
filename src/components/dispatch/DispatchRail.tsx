import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUp, CalendarDays, ChevronDown, ChevronsDownUp, ChevronsUpDown,
  Gauge, ListTree, Package, PanelRightClose, PanelRightOpen, Search, Undo2, UserPlus, Wrench, X,
} from 'lucide-react';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  railAnchorId, railJumpToDay, railScrollTo, useRail, type RailSection, type RailTone,
} from '@/lib/dispatch-rail-store';

/**
 * מסילת הניווט של מסך הסדרן.
 *
 * עידן, 06/09/2026: "תפריט צד שיעזור בניווט במערכת. המערכת מאוד ארוכה
 * והמשתמשים מתלוננים שהם גוללים המון." ההחלטות שלו: מסילה דביקה בצד ימין
 * במסך רחב וכפתור עגול שפותח תפריט במסך צר · מסננים סגורים כברירת מחדל
 * ואזורי העבודה פתוחים · עוגני יומן לפי יום עם ספירה.
 *
 * ⭐ כל שורה היא גם ניווט (לחיצה גוללת לאזור) וגם מתג (החץ סוגר ופותח את
 * האזור עצמו, אותו חץ שעל הכותרת). האזור שעל המסך מודגש. המסילה נבנית
 * מהאזורים שרשמו את עצמם (`dispatch-rail-store`), ולכן היא נכונה בכל
 * לשונית בלי רשימה קבועה.
 */

const ICONS = {
  alert: AlertTriangle, search: Search, gauge: Gauge, undo: Undo2, package: Package,
  wrench: Wrench, pickup: Undo2, user: UserPlus, calendar: CalendarDays,
} as const;

const TONES: Record<RailTone, { icon: string; active: string; pill: string; bar: string }> = {
  amber:   { icon: 'bg-amber-100 text-amber-700',   active: 'bg-amber-50',   pill: 'bg-amber-100 text-amber-800',   bar: 'bg-amber-500' },
  slate:   { icon: 'bg-slate-100 text-slate-600',   active: 'bg-slate-100',  pill: 'bg-slate-200 text-slate-700',   bar: 'bg-slate-500' },
  red:     { icon: 'bg-red-100 text-red-700',       active: 'bg-red-50',     pill: 'bg-red-100 text-red-800',       bar: 'bg-red-500' },
  blue:    { icon: 'bg-blue-100 text-blue-700',     active: 'bg-blue-50',    pill: 'bg-blue-100 text-blue-800',     bar: 'bg-blue-600' },
  teal:    { icon: 'bg-teal-100 text-teal-700',     active: 'bg-teal-50',    pill: 'bg-teal-100 text-teal-800',     bar: 'bg-teal-600' },
  violet:  { icon: 'bg-violet-100 text-violet-700', active: 'bg-violet-50',  pill: 'bg-violet-100 text-violet-800', bar: 'bg-violet-600' },
  emerald: { icon: 'bg-emerald-100 text-emerald-700', active: 'bg-emerald-50', pill: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-600' },
};

/** האזור שנמצא כרגע על המסך: האחרון שהראש שלו עבר את הקו שמתחת לכותרת. */
function useActiveSection(sections: RailSection[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-header-h')) || 61;
      const line = headerH + 120;
      let current: string | null = null;
      for (const s of sections) {
        const el = document.getElementById(railAnchorId(s.id));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = s.id;
      }
      // בתחתית העמוד האזור האחרון הוא הפעיל גם אם הראש שלו רחוק למעלה.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 8 && sections.length) {
        current = sections[sections.length - 1].id;
      }
      setActive(current ?? sections[0]?.id ?? null);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [sections]);
  return active;
}

/** Alt+1..9 קופץ לאזור לפי הסדר במסילה. */
function useRailHotkeys(sections: RailSection[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      const s = sections[n - 1];
      if (!s) return;
      e.preventDefault();
      railScrollTo(s.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sections]);
}

function RailList({ compact = false, onNavigate, onMini }: { compact?: boolean; onNavigate?: () => void; onMini?: () => void }) {
  const { sections, days } = useRail();
  const active = useActiveSection(sections);
  const collapsible = useMemo(() => sections.filter((s) => s.toggle), [sections]);
  const allCollapsed = collapsible.length > 0 && collapsible.every((s) => s.collapsed);

  const setAll = (collapsed: boolean) => {
    for (const s of collapsible) {
      // היומן הוא היעד; "כווץ הכל" לא סוגר אותו.
      if (s.id === 'calendar') continue;
      if (Boolean(s.collapsed) !== collapsed) s.toggle?.();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <span className="flex items-center gap-1">
          {onMini && (
            <button
              type="button"
              onClick={onMini}
              title="כווץ את התפריט לפס סמלים"
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">במסך</span>
        </span>
        <button
          type="button"
          onClick={() => setAll(!allCollapsed)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title={allCollapsed ? 'פתח את כל האזורים' : 'כווץ את כל האזורים (חוץ מהיומן)'}
        >
          {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
          {allCollapsed ? 'פתח הכל' : 'כווץ הכל'}
        </button>
      </div>

      <div className="relative flex flex-col gap-0.5">
        {/* קו הזמן הדק שמחבר את הסמלים */}
        <div className="pointer-events-none absolute bottom-3 top-3 start-[21px] w-px bg-slate-200" />
        {sections.map((s, idx) => {
          const Icon = ICONS[s.icon];
          const tone = TONES[s.tone];
          const isActive = s.id === active;
          const isCollapsed = Boolean(s.collapsed);
          return (
            <div key={s.id} className="relative">
              <button
                type="button"
                onClick={() => { railScrollTo(s.id); onNavigate?.(); }}
                className={cn(
                  'group relative flex w-full items-center gap-2 rounded-xl py-1.5 pe-1.5 ps-2 text-start text-[13px] transition-colors',
                  isActive ? cn(tone.active, 'font-semibold text-slate-900') : 'text-slate-600 hover:bg-slate-50',
                  isCollapsed && !isActive && 'text-slate-400',
                )}
                title={`${s.title}${idx < 9 ? ` · Alt+${idx + 1}` : ''}`}
              >
                {isActive && <span className={cn('absolute inset-y-1.5 start-0 w-[3px] rounded-full', tone.bar)} />}
                <span className={cn('relative z-[1] flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg', tone.icon, isCollapsed && !isActive && 'opacity-60')}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 whitespace-normal leading-[1.15]">{s.short ?? s.title}</span>
                {s.count != null && s.count > 0 && (
                  <span className={cn('rounded-full px-1.5 py-px text-[10.5px] font-semibold tabular-nums', isActive ? tone.pill : 'bg-slate-100 text-slate-500')}>
                    {s.count}
                  </span>
                )}
                {s.toggle && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); s.toggle?.(); }}
                    title={isCollapsed ? 'פתח את האזור' : 'כווץ את האזור'}
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && 'rotate-90')} />
                  </span>
                )}
              </button>

              {s.id === 'calendar' && days.length > 0 && !compact && (
                <div className="mb-1 ms-[38px] mt-0.5 flex flex-col gap-px">
                  {days.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => { railJumpToDay(d.date); onNavigate?.(); }}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-2 py-1 text-[12px] hover:bg-slate-50',
                        d.isToday ? 'font-semibold text-emerald-800' : 'text-slate-500',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {d.isToday && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        {d.label}
                      </span>
                      <span className={cn('rounded-full px-1.5 text-[10.5px] tabular-nums', d.isToday ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500')}>
                        {d.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t pt-2">
        <button
          type="button"
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); onNavigate?.(); }}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        >
          <ArrowUp className="h-3 w-3" /> למעלה
        </button>
        <button
          type="button"
          onClick={() => { railScrollTo('calendar'); onNavigate?.(); }}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        >
          <CalendarDays className="h-3 w-3" /> ליומן
        </button>
      </div>
    </div>
  );
}

/**
 * המסילה המכווצת: פס סמלים צר (עידן, 06/09/2026: "תוסיף אפשרות לכווץ את
 * התפריט צד"). אותם אזורים, אותה הדגשה של האזור הנוכחי, ספירה קטנה על
 * הסמל, והכותרת בריחוף. לחיצה על סמל גוללת; החץ למעלה מרחיב חזרה.
 */
function RailMini({ onExpand }: { onExpand: () => void }) {
  const { sections, days } = useRail();
  const active = useActiveSection(sections);
  const today = days.find((d) => d.isToday);
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onExpand}
        title="הרחב את התפריט"
        className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
      {sections.map((s, idx) => {
        const Icon = ICONS[s.icon];
        const tone = TONES[s.tone];
        const isActive = s.id === active;
        const isCollapsed = Boolean(s.collapsed);
        const count = s.id === 'calendar' && today ? today.count : s.count;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => railScrollTo(s.id)}
            title={`${s.title}${s.count ? ` (${s.count})` : ''}${isCollapsed ? ' · מכווץ' : ''}${idx < 9 ? ` · Alt+${idx + 1}` : ''}`}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              isActive ? tone.active : 'hover:bg-slate-50',
            )}
          >
            {isActive && <span className={cn('absolute inset-y-2 start-0 w-[3px] rounded-full', tone.bar)} />}
            <span className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-lg', tone.icon, isCollapsed && !isActive && 'opacity-50')}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            {count != null && count > 0 && (
              <span className={cn(
                'absolute -end-0.5 -top-0.5 min-w-[18px] rounded-full px-1 text-center text-[9.5px] font-semibold leading-[16px] tabular-nums ring-2 ring-white',
                isActive ? tone.pill : 'bg-slate-200 text-slate-700',
              )}>
                {count > 999 ? '999+' : count}
              </span>
            )}
          </button>
        );
      })}
      <div className="mt-1 flex flex-col gap-1 border-t pt-2">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="למעלה" className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-600 hover:bg-slate-50"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => railScrollTo('calendar')} title="ליומן" className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-600 hover:bg-slate-50"><CalendarDays className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/** המסילה במסך רחב: דביקה מתחת ללשוניות. רחבה (236px) או מכווצת לפס סמלים (56px), נזכר לכל משתמש. */
export function DispatchRail() {
  const { sections } = useRail();
  useRailHotkeys(sections);
  const [mini, toggleMini] = usePersistedCollapse('collapse:dispatch-rail-mini');
  if (!sections.length) return null;
  return (
    <aside
      dir="rtl"
      className={cn(
        'sticky top-[calc(var(--app-header-h,61px)+68px)] hidden max-h-[calc(100vh-var(--app-header-h,61px)-84px)] shrink-0 overflow-y-auto rounded-2xl border bg-white/90 shadow-[0_8px_30px_-12px_rgba(20,34,58,.25)] backdrop-blur transition-[width] duration-200 xl:block',
        mini ? 'w-[56px] p-1.5' : 'w-[236px] p-2',
      )}
    >
      {mini ? <RailMini onExpand={toggleMini} /> : <RailList onMini={toggleMini} />}
    </aside>
  );
}

/** מסך צר: כפתור עגול בפינה, שפותח את אותה מסילה כתפריט צד. */
export function DispatchRailFab() {
  const { sections } = useRail();
  const [open, setOpen] = useState(false);
  if (!sections.length) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ניווט במסך"
        className="fixed bottom-5 end-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 xl:hidden"
      >
        <ListTree className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[260px] p-3" dir="rtl">
          <SheetHeader className="mb-2 flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-sm">ניווט במסך</SheetTitle>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </SheetHeader>
          <RailList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
