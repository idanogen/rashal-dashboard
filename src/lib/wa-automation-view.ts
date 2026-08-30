/**
 * חדר הבקרה של אוטומציות הוואטסאפ: ההיגיון הטהור של התצוגה.
 *
 * עידן, 30/08/2026: "אני רוצה שיהיה לנו מקום אחד שהכל מרוכז. זה מתחיל
 * להיות הרבה תהליכים וקשה לי לנהל."
 *
 * שלושת המצבים של מנוע: פעיל (שולח באמת) · מצב יבש (מחשב ומדווח, לא
 * שולח) · כבוי (לא נוגע אפילו בתור). ההבחנה בין יבש לכבוי חשובה:
 * מנוע יבש עוקב וכשמדליקים אותו יש היסטוריה, מנוע כבוי עיוור לגמרי.
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */

export interface EngineState {
  label: string;
  tone: 'green' | 'amber' | 'gray';
}

export function engineState(enabled: boolean, dryRun: boolean): EngineState {
  if (!enabled) return { label: 'כבוי', tone: 'gray' };
  if (dryRun) return { label: 'מצב יבש', tone: 'amber' };
  return { label: 'פעיל', tone: 'green' };
}

export const ENGINE_STATE_CLASS: Record<EngineState['tone'], string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  gray: 'bg-slate-100 text-slate-600',
};

/** "לפני 4 דקות" · "לפני 3 שעות" · "12/08/26". ריק כשאין תאריך. */
export function sinceLabel(iso: string | null | undefined, now: Date): string {
  if (!iso) return '';
  const then = new Date(iso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (mins < 1) return 'ממש עכשיו';
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
  const d = String(then.getDate()).padStart(2, '0');
  const m = String(then.getMonth() + 1).padStart(2, '0');
  const y = String(then.getFullYear()).slice(2);
  return `${d}/${m}/${y}`;
}
