import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, History } from 'lucide-react';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import { historySearch } from '@/lib/history';
import { historyHitLine, type HistoryHit, type Tone } from '@/lib/history-line';
import { cn } from '@/lib/utils';
import type { VisitPrefill } from '@/components/dispatch/UnscheduledPanel';

/**
 * רצועת "בהיסטוריה" מתחת לחיפוש הסדרן (עידן, 07/09/2026).
 *
 * 🔴 הרקע: החיפוש ראה רק ממתינים מ-180 יום, ו"כבר טופלו" הופיע רק כשאין
 * אף ממתין באותו פאנל. "חייט" החזיר ממתין אחד ואפס רמז לחמישה לקוחות
 * נוספים בשם הזה עם אספקות מ-2021 עד 2025. הרצועה מופיעה בכל חיפוש,
 * מכל השנים, ואומרת לכל לקוח מה האירוע האחרון שלו ומה פתוח עכשיו.
 * "כרטיס" פותח את ציר הלקוח המלא, "שבץ ביקור" מחליף את "כבר טופלו".
 */
const TONE_CLASS: Record<Tone, string> = {
  good: 'text-emerald-700',
  bad: 'text-amber-700',
  neutral: 'text-slate-600',
  new: 'text-slate-400',
};

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function HistoryStrip({
  query,
  onScheduleVisit,
}: {
  query: string;
  onScheduleVisit?: (prefill: VisitPrefill) => void;
}) {
  const q = useDebounced(query.trim(), 300);
  const { data, isFetching, isError } = useQuery({
    queryKey: ['history-search', q],
    queryFn: () => historySearch(q, 8),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
  if (q.length < 2) return null;
  return (
    <HistoryStripView
      hits={data ?? []}
      loading={isFetching && !data}
      error={isError}
      onScheduleVisit={onScheduleVisit}
    />
  );
}

/** התצוגה בלבד, כדי שאפשר לצלם אותה ב-preview.html בלי מסד. */
export function HistoryStripView({
  hits,
  loading = false,
  error = false,
  onScheduleVisit,
}: {
  hits: HistoryHit[];
  loading?: boolean;
  error?: boolean;
  onScheduleVisit?: (prefill: VisitPrefill) => void;
}) {
  const [collapsed, toggleCollapsed] = usePersistedCollapse('collapse:dispatch-history-strip', false);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 text-sm" data-testid="history-strip">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center gap-2 px-3 py-2 text-start"
        title={collapsed ? 'פתח את ההיסטוריה' : 'כווץ את ההיסטוריה'}
      >
        <History className="h-4 w-4 text-slate-500" />
        <span className="font-semibold text-slate-800">בהיסטוריה</span>
        {loading ? (
          <span className="text-xs text-slate-400">מחפש…</span>
        ) : error ? (
          <span className="text-xs text-red-600">החיפוש בהיסטוריה נכשל</span>
        ) : (
          <span className="rounded-full bg-blue-100 px-2 text-xs font-semibold tabular-nums text-blue-800">
            {hits.length === 0 ? 'אף לקוח מוכר' : hits.length === 1 ? 'לקוח אחד' : `${hits.length} לקוחות`}
          </span>
        )}
        <span className="text-xs text-slate-500">לא ברשימות הממתינים, אבל מוכרים לנו, מכל השנים</span>
        <ChevronDown className={cn('ms-auto h-4 w-4 text-slate-400 transition-transform', collapsed && 'rotate-90')} />
      </button>

      {!collapsed && hits.length > 0 && (
        <ul className="divide-y divide-slate-200 border-t border-slate-200">
          {hits.map((h) => {
            const line = historyHitLine(h);
            return (
              <li key={`${h.customerNumber ?? ''}|${h.customerName ?? ''}|${h.phone ?? ''}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                <span className="min-w-0 font-semibold text-slate-800">
                  {h.customerName}
                  {h.customerNumber && <bdi className="ms-1.5 text-xs font-normal text-slate-500">{h.customerNumber}</bdi>}
                </span>
                {h.city && <span className="text-xs text-slate-500">{h.city}</span>}
                <span className={cn('min-w-0 flex-1 text-xs', TONE_CLASS[line.tone])}>{line.text}</span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <CustomerCardButton
                    customerNumber={h.customerNumber ?? undefined}
                    phone={h.phone ?? undefined}
                    name={h.customerName ?? undefined}
                    className="h-6 text-[11px]"
                  />
                  {onScheduleVisit && (
                    <button
                      type="button"
                      onClick={() =>
                        onScheduleVisit({
                          customerName: h.customerName ?? '',
                          customerNumber: h.customerNumber ?? undefined,
                          phone: h.phone ?? undefined,
                          city: h.city ?? undefined,
                        })
                      }
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      title="שיבוץ ביקור חדש ללקוח הזה, ישירות ליומן"
                    >
                      <CalendarDays className="h-3 w-3" />
                      שבץ ביקור
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
