import { useMemo } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import type { CalendarStop } from '@/types/calendar-stop';
import { STOP_SOURCE_LABELS } from '@/types/calendar-stop';

/**
 * עצירות בתאריכי עבר שנשארו פתוחות.
 *
 * למה זה קיים: מדידה ב-12/08/2026 מצאה 116 עצירות בתאריכי עבר בסטטוס
 * "בדרך" (הנהג לחץ "הגעתי" ולא סגר), 101 מהן של נהג אחד, על פני חודש וחצי.
 * ההזמנות שלהן נשארו "תואמה אספקה" ולא "סופק", ואף מסך לא הציג את זה.
 * "חזרו מהקו" תופס רק את מי שסומן "לא בוצע", ולא את מי שלא סומן כלל.
 */
interface StuckStopsAlertProps {
  stops: CalendarStop[];
  onResolve: (stopId: string, status: 'completed' | 'not_completed') => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

export function StuckStopsAlert({ stops, onResolve }: StuckStopsAlertProps) {
  const [collapsed, toggle] = usePersistedCollapse('collapse:dispatch-stuck');

  const stuck = useMemo(() => {
    const today = todayStr();
    return stops
      .filter(
        (s) =>
          s.deliveryDate < today &&
          (s.status === 'planned' || s.status === 'in_progress')
      )
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
  }, [stops]);

  if (stuck.length === 0) return null;

  const arrived = stuck.filter((s) => s.status === 'in_progress').length;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-none text-amber-600" />
        <span className="text-sm font-bold text-amber-900">
          {stuck.length} עצירות בתאריכי עבר נשארו פתוחות
        </span>
        <span className="text-xs text-amber-800">
          {arrived > 0
            ? `${arrived} מהן סומנו "הגעתי" ולא נסגרו. ההזמנה עדיין לא רשומה כסופקה.`
            : 'לא סומנו כלל, לא בוצע ולא לא בוצע.'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="ms-auto h-7 gap-1 px-2 text-xs text-amber-800 hover:bg-amber-100"
        >
          {collapsed ? 'הצג' : 'הסתר'}
          {collapsed ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {!collapsed && (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pe-1">
          {stuck.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-card px-2.5 py-1.5 text-xs"
            >
              <span className="font-semibold">{s.customerName}</span>
              <span className="text-muted-foreground">
                {STOP_SOURCE_LABELS[s.sourceType]} · {s.driver} · {formatDate(s.deliveryDate)}
              </span>
              {s.status === 'in_progress' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                  הגיע ולא נסגר
                </span>
              )}
              <div className="ms-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(s.id, 'completed')}
                  className="h-6 gap-1 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"
                >
                  <Check className="h-3 w-3" />
                  בוצע
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(s.id, 'not_completed')}
                  className="h-6 gap-1 px-2 text-[11px] text-red-700 hover:bg-red-50"
                >
                  <X className="h-3 w-3" />
                  לא בוצע
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
