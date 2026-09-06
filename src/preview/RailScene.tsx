import { useEffect, useState } from 'react';
import { DispatchRail, DispatchRailFab } from '@/components/dispatch/DispatchRail';
import { railAnchorId, railRegister, railSetDays, railUnregister } from '@/lib/dispatch-rail-store';

/**
 * ?view=rail: מסילת הניווט של מסך הסדרן על עמוד ארוך מדומה, כדי לראות את
 * העיצוב, ההדגשה של האזור הנוכחי, החצים והעוגנים של היומן בלי להתחבר.
 */
const SECTIONS = [
  { id: 'stuck', title: 'עצירות עבר פתוחות', short: 'עצירות עבר', order: 10, tone: 'amber', icon: 'alert', count: 6, h: 120, def: true },
  { id: 'filters', title: 'חיפוש ואזורים', order: 20, tone: 'slate', icon: 'search', count: null, h: 260, def: false },
  { id: 'stats', title: 'סטטוס וכפילויות', order: 30, tone: 'slate', icon: 'gauge', count: 20, h: 140, def: true },
  { id: 'orders-returned', title: 'חזרו מהקו', order: 40, tone: 'red', icon: 'undo', count: 24, h: 200, def: false },
  { id: 'orders-list', title: 'הזמנות ממתינות לתיאום', short: 'ממתינים לתיאום', order: 41, tone: 'blue', icon: 'package', count: 759, h: 900, def: false },
  { id: 'calls-list', title: 'קריאות שירות חדשות', short: 'קריאות חדשות', order: 51, tone: 'teal', icon: 'wrench', count: 401, h: 700, def: false },
  { id: 'calendar', title: 'היומן', order: 90, tone: 'emerald', icon: 'calendar', count: null, h: 1100, def: false },
] as const;

// ?view=rail&mini=1 מצלם את המצב המכווץ.
if (new URLSearchParams(location.search).get('mini') === '1') {
  try { localStorage.setItem('collapse:dispatch-rail-mini', '1'); } catch { /* ignore */ }
} else {
  try { localStorage.removeItem('collapse:dispatch-rail-mini'); } catch { /* ignore */ }
}

export function RailScene() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, s.def])));

  useEffect(() => {
    for (const s of SECTIONS) {
      railRegister({
        id: s.id, title: s.title, short: 'short' in s ? s.short : undefined, order: s.order, tone: s.tone, icon: s.icon, count: s.count,
        collapsed: s.id === 'calendar' ? undefined : collapsed[s.id],
        toggle: s.id === 'calendar' ? undefined : () => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] })),
      });
    }
    railSetDays([
      { date: '2026-09-06', label: 'ראשון 6/9', count: 35, isToday: true },
      { date: '2026-09-07', label: 'שני 7/9', count: 28, isToday: false },
      { date: '2026-09-08', label: 'שלישי 8/9', count: 12, isToday: false },
      { date: '2026-09-09', label: 'רביעי 9/9', count: 9, isToday: false },
      { date: '2026-09-10', label: 'חמישי 10/9', count: 4, isToday: false },
    ]);
    return () => { for (const s of SECTIONS) railUnregister(s.id); railSetDays([]); };
  }, [collapsed]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50" style={{ ['--app-header-h' as string]: '61px' }}>
      <div className="sticky top-0 z-40 flex h-[61px] items-center border-b bg-white px-6 text-sm font-semibold text-slate-800">דשבורד הזמנות · מסך סדרן (תצוגה מקדימה)</div>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <DispatchRail />
          <div className="min-w-0 flex-1 space-y-6">
            <div className="sticky top-[61px] z-30 -mx-6 border-b bg-white/95 px-6 py-2 text-xs text-slate-500 backdrop-blur">הכל 1707 · משלוחים 783 · קריאות שירות 401 · איסופים 284 · לקוחות חדשים 239</div>
            {SECTIONS.map((s) => (
              <div key={s.id} id={railAnchorId(s.id)} className="scroll-mt-32 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>{s.title}{s.count ? ` (${s.count})` : ''}</span>
                  <span className="text-xs font-normal text-slate-400">{collapsed[s.id] ? 'מכווץ' : ''}</span>
                </div>
                {!collapsed[s.id] && <div className="mt-3 rounded-lg bg-slate-100" style={{ height: s.h }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <DispatchRailFab />
    </div>
  );
}
