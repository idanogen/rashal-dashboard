import { CalendarClock } from 'lucide-react';
import { visitRecency, visitOutcomeLabel, localDateStr } from '@/lib/visit-history';

/**
 * "ביקור אחרון" על תוצאת חיפוש ועל כרטיס הלקוח (בקשת עמי, 30/08/2026).
 *
 * ביקור טרי (עד 30 יום) מודגש כגלולה צבעונית: ירוק כשבוצע, ענבר כשנרשם
 * "לא בוצע", כי דווקא ניסיון שנכשל לאחרונה הוא מה שהנציג צריך לדעת.
 * ביקור ישן יורד לשורת טקסט שקטה. אין ביקור, אין שורה בכלל.
 */
export function LastVisitBadge({
  date,
  driver,
  outcome,
}: {
  date: string;
  driver?: string | null;
  outcome?: string | null;
}) {
  const r = visitRecency(date, localDateStr(new Date()));
  const parts = [visitOutcomeLabel(outcome), driver ?? ''].filter(Boolean).join(' · ');

  if (!r.recent) {
    return (
      <div className="mt-1 text-[10.5px] text-muted-foreground">
        ביקור אחרון <bdi>{r.label}</bdi>
        {parts && ` · ${parts}`}
      </div>
    );
  }

  const warn = outcome === 'not_completed';
  return (
    <div className="mt-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
          warn ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
        }`}
      >
        <CalendarClock className="h-3 w-3" />
        ביקור אחרון <bdi>{r.label}</bdi>
        {parts && ` · ${parts}`}
      </span>
    </div>
  );
}
