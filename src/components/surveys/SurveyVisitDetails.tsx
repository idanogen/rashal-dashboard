import {
  arrivalNote, essenceText, historyText, nowText, outcomeText, visitLine, type SurveyVisit,
} from '@/lib/survey-visit';

/**
 * על איזה ביקור הלקוח דירג, ומה המצב עכשיו (עידן, 26/10/2026: "חסר לי
 * פה תאריך הביקור ומהות הביקור"). הסדר הוא סדר השאלות של מנהל לפני
 * שהוא מרים טלפון: מה היה, מה הטכנאי סיכם, והאם כבר מטפלים בזה.
 *
 * 🔴 היעדר מדבר: בלי ביקור משובץ ובלי קריאה פתוחה כתוב את זה במפורש,
 * כי שורה ריקה נראית בדיוק כמו "עוד לא נטען".
 */
export function SurveyVisitDetails({
  visit, driver, state,
}: {
  visit: SurveyVisit | undefined;
  driver: string | null;
  state: 'loading' | 'error' | 'ready';
}) {
  if (state === 'loading') {
    return <span className="mt-1 block h-3 w-40 animate-pulse rounded bg-slate-100" />;
  }
  if (state === 'error') {
    return <span className="mt-0.5 block text-[11px] text-amber-700">פרטי הביקור לא נטענו</span>;
  }
  if (!visit || !visit.visitType) {
    return <span className="mt-0.5 block text-[11px] text-slate-400">הסקר לא מקושר לביקור ביומן</span>;
  }

  const essence = essenceText(visit);
  const device = visit.visitType === 'service' && visit.device ? visit.device.slice(0, 40).trim() : null;
  const outcome = outcomeText(visit);
  const arrival = arrivalNote(visit);
  const now = nowText(visit);
  const history = historyText(visit);

  return (
    <div className="mt-1 space-y-0.5 text-[11.5px] leading-snug">
      <span className="block font-semibold text-slate-600">
        <bdi>{visitLine(visit, driver)}</bdi>
      </span>
      {(essence || device) && (
        <span className="block text-slate-700">
          {essence}
          {device && <span className="text-slate-400">{essence ? ' · ' : ''}<bdi>{device}</bdi></span>}
        </span>
      )}
      {outcome && (
        <span className="block text-slate-500">
          <span className="text-slate-400">הטכנאי: </span>
          {outcome}
        </span>
      )}
      {arrival && (
        <span className={`block text-[11px] ${arrival.lateMin > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
          {arrival.text}
        </span>
      )}
      {history && <span className="block text-[11px] font-semibold text-rose-700">{history}</span>}
      <span
        className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
          now?.tone === 'active'
            ? 'bg-emerald-50 text-emerald-800'
            : now?.tone === 'open'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-slate-100 text-slate-500'
        }`}
      >
        {now ? now.text : 'אין כרגע קריאה פתוחה או ביקור משובץ'}
      </span>
    </div>
  );
}
