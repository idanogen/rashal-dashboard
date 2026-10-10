/**
 * דחיפות בתיבת השיחות (עידן אישר את ההגדרה, 08/10/2026).
 *
 * ⭐ דחיפות היא **תג על שיחה עם סיבה במילים**, לא תיבה נפרדת. שני מקורות:
 * כללים אוטומטיים (על שיחה שמחכה) וסימון ידני של הנציגה. כל תג נושא את
 * הסיבה שלו, כדי שהנציגה תדע למה הוא אדום ולא תלמד להתעלם ממנו.
 *
 * 🔴 קובץ טהור בלי ייבוא (כמו `inbox.ts`), כדי שייבדק ב-`test/urgency.test.mjs`.
 * שעות העבודה מחושבות כאן בשעון ישראל, כי Vercel רץ ב-UTC.
 */

export interface UrgencyFacts {
  /** ההודעה הנכנסת האנושית האחרונה, לחיפוש מילות דחיפות. */
  lastInboundBody?: string | null;
  /** YYYY-MM-DD של הביקור הקרוב (היום או מחר), כשיש. */
  nextStopDate?: string | null;
}

export interface UrgencyInput {
  waitingMinutes: number | null;
  survey?: { score: number | null; comment: string | null } | null;
  urgentMarkedAt?: string | null;
  urgentMarkedBy?: string | null;
  lastHumanAt?: string | null;
  lastHumanDirection?: string | null;
}

export interface Urgency {
  active: boolean;
  /** הסיבות במילים, לתג. ריק כשלא דחוף. */
  reasons: string[];
  /** הסימון הידני פעיל (לא נענה מאז). */
  manual: boolean;
  markedBy?: string | null;
}

/** הסף: שעה בלי מענה בשעות העבודה. */
export const WAITING_URGENT_MINUTES = 60;

/**
 * מילות דחיפות בהודעת הלקוח. הרשימה פתוחה לעמי ולשלומי.
 * 🔴 גבולות מילה בעברית: "נפל" בתוך "נפלא" לא נספר, "לא עובד" כן.
 */
export const URGENT_WORDS = ['דחוף', 'בדחיפות', 'נפל', 'נפלה', 'נתקע', 'נתקעה', 'לא עובד', 'לא עובדת', 'לא נדלק', 'לא נדלקת', 'חירום', 'מסוכן', 'מסוכנת'];

const HEB = 'א-ת';
const WORD_RE = new RegExp(`(^|[^${HEB}])(${URGENT_WORDS.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})(?=$|[^${HEB}])`);

export function urgentWord(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = WORD_RE.exec(text);
  return m ? m[2].replace(/\s+/g, ' ') : null;
}

/** תאריך YYYY-MM-DD בשעון ישראל. */
export function israelDate(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

/** שעות העבודה בשעון ישראל: א-ה 07:00 עד 19:00, שישי 07:00 עד 13:00. */
export function isWorkHoursIL(now: number): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', weekday: 'short', hour: '2-digit' })
    .formatToParts(new Date(now));
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  if (wd === 'Sat') return false;
  if (wd === 'Fri') return hr >= 7 && hr < 13;
  return hr >= 7 && hr < 19;
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * הסימון הידני פעיל כל עוד לא ענינו ללקוח מאז. "ענינו" = ההודעה האנושית
 * האחרונה יצאה מאיתנו אחרי הסימון. ככה הוא יורד לבד במענה, בלי טריגר.
 */
export function manualActive(input: UrgencyInput): boolean {
  if (!input.urgentMarkedAt) return false;
  if (input.lastHumanDirection !== 'out' || !input.lastHumanAt) return true;
  return new Date(input.lastHumanAt).getTime() < new Date(input.urgentMarkedAt).getTime();
}

export function urgencyOf(input: UrgencyInput, facts: UrgencyFacts | undefined, now: number): Urgency {
  const reasons: string[] = [];
  const waiting = input.waitingMinutes != null;
  const manual = manualActive(input);
  if (manual) reasons.push(input.urgentMarkedBy ? `סומן על ידי ${input.urgentMarkedBy}` : 'סומן ידנית');

  if (waiting) {
    if ((input.waitingMinutes ?? 0) >= WAITING_URGENT_MINUTES && isWorkHoursIL(now)) {
      reasons.push('ממתין מעל שעה');
    }
    const today = israelDate(now);
    const stop = facts?.nextStopDate ?? null;
    if (stop === today) reasons.push('ביקור היום');
    else if (stop === addDays(today, 1)) reasons.push('ביקור מחר');
    const word = urgentWord(facts?.lastInboundBody);
    if (word) reasons.push(`כתב "${word}"`);
    const score = input.survey?.score;
    if (score != null && score <= 3 && (input.survey?.comment ?? '').trim()) reasons.push(`סקר ${score} עם הערה`);
  }

  return { active: reasons.length > 0, reasons, manual, markedBy: manual ? input.urgentMarkedBy ?? null : null };
}

/** "דחוף · ביקור מחר · כתב "נפל"" */
export function urgencyLabel(u: Urgency | null | undefined): string {
  if (!u || !u.active) return '';
  return ['דחוף', ...u.reasons].join(' · ');
}
