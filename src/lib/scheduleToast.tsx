import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import type { AssigneeName } from '@/types/route';

type ScheduleKind = 'delivery' | 'service';

function dayLabel(date?: string): string | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

/**
 * הודעת שיבוץ בולטת ומעוצבת (במקום טוסט טקסט קטן).
 * משמש את שני המסכים — משלוחים (נהג) וקריאות שירות (טכנאי).
 */
export function showScheduleToast(opts: {
  count: number;
  assignee: AssigneeName;
  date?: string;
  kind: ScheduleKind;
}) {
  const { count, assignee, date, kind } = opts;
  const roleWord = kind === 'service' ? 'לטכנאי' : 'לנהג';
  const itemWord =
    kind === 'service'
      ? count === 1
        ? 'קריאת שירות'
        : 'קריאות שירות'
      : count === 1
        ? 'הזמנה'
        : 'הזמנות';
  const day = dayLabel(date);

  toast.custom(
    () => (
      <div
        dir="rtl"
        className="flex w-[340px] max-w-[90vw] items-center gap-3 rounded-2xl border border-emerald-200 bg-card px-5 py-4 shadow-2xl ring-1 ring-emerald-500/15 dark:border-emerald-900"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight">
            שובצו {count} {itemWord}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {roleWord} <span className="font-semibold text-foreground">{assignee}</span>
            {day ? ` · יום ${day}` : ''}
          </div>
        </div>
      </div>
    ),
    { duration: 4000 }
  );
}
