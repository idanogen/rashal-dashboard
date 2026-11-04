/**
 * תזכורת הערב ללקוחות של מחר (עידן, 04/11/2026): "עדכון בלבד, בלי בקשת אישור",
 * גרסה א. הנוסח המלא יושב בתבנית שאושרה במטא (`rashal_visit_reminder`), וכאן
 * רק ערכי המשתנים, לכן כל שינוי כאן חייב להתאים לגוף שאושר:
 *   שלום {{customer_name}}, כאן ר.שעל שירותי עזר לנכים. תזכורת: מחר, ביום {{day}},
 *   {{purpose}} {{hours}}. אם המועד לא מתאים לכם, אפשר להשיב כאן ונתאם מחדש. תודה, צוות ר.שעל
 * 🔴 קובץ טהור בלי ייבוא, נבדק ב-`test/reminder-text.test.mjs`.
 */
export const REMINDER_TEMPLATE_KEY = 'rashal_visit_reminder';
export const REMINDER_REPORT_TEMPLATE_KEY = 'rashal_reminder_report';
/** שעת השליחה בשעון ישראל. הקרון של Vercel רץ ב-UTC ולא יודע שעון קיץ, לכן נבדק כאן. */
export const REMINDER_HOUR_ISRAEL = 19;
/**
 * מוצאי שבת (עידן 04/11: "גם במוצאי שבת, כי זה לפני יום ראשון"): 20:30 ולא 19:00,
 * כי בקיץ שבת יוצאת אחרי 20:00 והודעה ב-19:00 הייתה נכנסת לשבת של הלקוח.
 */
export const REMINDER_HOUR_SATURDAY = 20;

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** סוג הביקור, משפט שלם כי הוא עומד בעצמו בתוך התבנית. */
export const PURPOSE_BY_SOURCE: Record<string, string> = {
  delivery: 'נגיע אליכם עם האספקה',
  customer: 'נגיע אליכם עם האספקה',
  pickup: 'נגיע אליכם לאיסוף הציוד',
  service: 'טכנאי שלנו יגיע אליכם לביקור שירות',
  inspection: 'טכנאי שלנו יגיע אליכם לביקור שירות',
  task: 'טכנאי שלנו יגיע אליכם',
};

/** "חמישי, 5.11.2026". 🔴 בלי "יום" בהתחלה: התבנית אומרת "ביום {{day}}". */
export function reminderDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return String(iso ?? '');
  const [, y, mo, d] = m;
  const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(at.getTime())) return iso;
  return `${DAY_NAMES[at.getUTCDay()]}, ${Number(d)}.${Number(mo)}.${y}`;
}

/** "בין 10:00 ל-12:00", ובלי חלון "במהלך היום" (עידן: עצירה בלי שעות לא נשארת בלי מילה). */
export function reminderHours(start: string | null | undefined, end: string | null | undefined): string {
  const s = (start ?? '').trim().slice(0, 5);
  const e = (end ?? '').trim().slice(0, 5);
  if (s && e) return `בין ${s} ל-${e}`;
  if (s) return `החל מ-${s}`;
  if (e) return `עד ${e}`;
  return 'במהלך היום';
}

export interface ReminderStop {
  customer_name: string | null;
  source_type: string;
  delivery_date: string;
  time_window_start: string | null;
  time_window_end: string | null;
}

/** ערכי המשתנים לתבנית, בסדר שבו הם מוגדרים במטא. */
export function reminderValues(stop: ReminderStop): { customer_name: string; day: string; purpose: string; hours: string } {
  return {
    customer_name: (stop.customer_name ?? '').trim() || 'לקוח יקר',
    day: reminderDay(stop.delivery_date),
    purpose: PURPOSE_BY_SOURCE[stop.source_type] ?? PURPOSE_BY_SOURCE.task,
    hours: reminderHours(stop.time_window_start, stop.time_window_end),
  };
}

/** תצוגה מקדימה, זהה למבנה הגוף שאושר, להרצה היבשה ולמסך. */
export function reminderPreview(v: ReturnType<typeof reminderValues>): string {
  return `שלום ${v.customer_name}, כאן ר.שעל שירותי עזר לנכים. תזכורת: מחר, ביום ${v.day}, ${v.purpose} ${v.hours}. ` +
    'אם המועד לא מתאים לכם, אפשר להשיב כאן ונתאם מחדש. תודה, צוות ר.שעל';
}

/**
 * האם זו שעת השליחה. ראשון עד חמישי: הקרון מוזמן ב-16:00 וב-17:00 UTC ורק הריצה
 * שנופלת על 19:00 בישראל שולחת. שבת: מוזמן ב-17:30 וב-18:30 UTC, ורק 20:xx בישראל.
 * שישי: אף פעם (אין עצירות בשבת).
 */
export function isReminderHour(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false, weekday: 'short' })
    .formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1') % 24;
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (wd === 'Fri') return false;
  if (wd === 'Sat') return h === REMINDER_HOUR_SATURDAY;
  return h === REMINDER_HOUR_ISRAEL;
}

export interface ReplyRow { customer_name: string | null; reply_text: string | null }

/**
 * ערכי תבנית הדוח למנהלים: "כהן דוד: "תגיעו אחרי 12", לוי שרה: "בסדר"",
 * קצוץ כדי לא לחרוג מהתבנית.
 */
export function repliesSummary(rows: ReplyRow[], max = 600): string {
  if (!rows.length) return 'אין תשובות';
  const parts = rows.map((r) => {
    const text = (r.reply_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return `${(r.customer_name ?? 'לקוח').trim()}: "${text}"`;
  });
  let out = '';
  for (const p of parts) {
    if ((out + (out ? ', ' : '') + p).length > max) { out += ` ועוד ${parts.length - parts.indexOf(p)}`; break; }
    out += (out ? ', ' : '') + p;
  }
  return out;
}
