/**
 * הניסוח של "מה היה אצל הלקוח", בלי שום ייבוא, ולכן נבדק ביחידה.
 *
 * ⭐ 07/09/2026: היסטוריה אחת לכל המסכים. שתי שורות נגזרות מכאן:
 *   1. שורת "ביקור אחרון" על הכרטיס בסדרן (מ-`customer_last_touch`).
 *   2. שורת "האירוע האחרון" ברצועת "בהיסטוריה" בחיפוש (מ-`history_search`).
 *
 * 🔴 מה שפריוריטי יודעת ומה שרק אנחנו יודעים מופרד בכוונה: "ביקור" הוא
 * מהיומן שלנו (מי נסע ומה יצא, מ-04/2026), "אספקה" מתעודת המשלוח
 * (מאפריל 2025), ו"קריאה" מפריוריטי (מ-2021, עם מי סגר).
 */

export interface LastTouch {
  visits: number;
  lastVisitDate: string | null;
  lastVisitDriver: string | null;
  lastVisitOutcome: string | null;
  deliveries: number;
  lastDeliveryDate: string | null;
  callsDone: number;
  lastCallDate: string | null;
  lastCallBy: string | null;
}

export type Tone = 'good' | 'bad' | 'neutral' | 'new';

/** DD/MM/YY מתאריך ISO (או YYYY-MM-DD). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

const OUTCOME: Record<string, string> = { completed: 'בוצע', not_completed: 'לא בוצע' };

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/**
 * השורה שעל הכרטיס. ביקור מהיומן קודם לכל, כי הוא היחיד שאומר מי נסע ומה
 * יצא; אחריו אספקה (מתעודה), ואחריה קריאה. בלי כלום: "לקוח חדש".
 */
export function lastTouchLine(t: LastTouch | null | undefined): { text: string; tone: Tone } {
  if (!t || (t.visits === 0 && t.deliveries === 0 && t.callsDone === 0)) {
    return { text: 'לקוח חדש, אין ביקורים קודמים', tone: 'new' };
  }
  const extras: string[] = [];
  if (t.visits > 0 && t.lastVisitDate) {
    const parts = [`ביקור אחרון ${shortDate(t.lastVisitDate)}`];
    if (t.lastVisitDriver) parts.push(t.lastVisitDriver);
    const oc = t.lastVisitOutcome ? OUTCOME[t.lastVisitOutcome] : undefined;
    if (oc) parts.push(oc);
    if (t.deliveries > 0) extras.push(plural(t.deliveries, 'אספקה קודמת', 'אספקות קודמות'));
    if (t.callsDone > 0) extras.push(plural(t.callsDone, 'קריאה קודמת', 'קריאות קודמות'));
    return {
      text: [...parts, ...extras].join(' · '),
      tone: t.lastVisitOutcome === 'not_completed' ? 'bad' : 'good',
    };
  }
  if (t.deliveries > 0) {
    const parts = [`אספקה אחרונה ${shortDate(t.lastDeliveryDate)}`];
    if (t.deliveries > 1) parts.push(`${t.deliveries} אספקות`);
    if (t.callsDone > 0) parts.push(plural(t.callsDone, 'קריאה קודמת', 'קריאות קודמות'));
    return { text: parts.join(' · '), tone: 'neutral' };
  }
  const parts = [`קריאה אחרונה ${shortDate(t.lastCallDate)}`];
  if (t.lastCallBy) parts.push(t.lastCallBy);
  if (t.callsDone > 1) parts.push(`${t.callsDone} קריאות`);
  return { text: parts.join(' · '), tone: 'neutral' };
}

export interface HistoryHit {
  customerNumber: string | null;
  customerName: string | null;
  phone: string | null;
  city: string | null;
  lastVisitDate: string | null;
  lastVisitDriver: string | null;
  lastVisitOutcome: string | null;
  lastOrderDate: string | null;
  lastOrderStatus: string | null;
  lastOrderRef: string | null;
  lastCallDate: string | null;
  lastCallStatus: string | null;
  lastCallRef: string | null;
  lastCallBy: string | null;
  lastCallType: string | null;
  lastNoteDate: string | null;
  openOrders: number;
  openCalls: number;
  deliveries: number;
}

const ORDER_OPEN = new Set(['ממתין לתאום', 'תואמה אספקה', 'אין במלאי', 'ממתין לליקוט']);
const CALL_OPEN = new Set(['קריאה חדשה', 'תואם ביקור']);

/**
 * שורת האירוע האחרון ברצועת החיפוש: מה קרה לאחרונה, ומה פתוח עכשיו.
 * ⭐ פתוח קודם לסגור: מי שיש לו הזמנה ממתינה צריך לדעת את זה לפני
 * שהוא קורא על אספקה מ-2024.
 */
export function historyHitLine(h: HistoryHit): { text: string; tone: Tone } {
  const open: string[] = [];
  if (h.openOrders > 0) open.push(plural(h.openOrders, 'הזמנה פתוחה', 'הזמנות פתוחות'));
  if (h.openCalls > 0) open.push(plural(h.openCalls, 'קריאה פתוחה', 'קריאות פתוחות'));

  const events: Array<{ d: string; text: string; tone: Tone }> = [];
  if (h.lastVisitDate) {
    const oc = h.lastVisitOutcome ? OUTCOME[h.lastVisitOutcome] : undefined;
    events.push({
      d: h.lastVisitDate,
      text: [`ביקור ${shortDate(h.lastVisitDate)}`, h.lastVisitDriver, oc].filter(Boolean).join(' · '),
      tone: h.lastVisitOutcome === 'not_completed' ? 'bad' : 'good',
    });
  }
  if (h.lastNoteDate) {
    events.push({ d: h.lastNoteDate, text: `אספקה ${shortDate(h.lastNoteDate)}`, tone: 'good' });
  }
  if (h.lastCallDate) {
    // סטטוס ריק (ייבוא היסטורי בלי סטטוס שלנו) אינו "פתוחה": לא טוענים מה שלא יודעים.
    const known = !!h.lastCallStatus;
    const done = known && !CALL_OPEN.has(h.lastCallStatus!);
    const who = h.lastCallBy && h.lastCallType === 'פרונטלית' ? `טכנאי ${h.lastCallBy}` : null;
    events.push({
      d: h.lastCallDate,
      text: [`קריאת שירות ${shortDate(h.lastCallDate)}`, !known ? null : done ? h.lastCallStatus : 'פתוחה', who].filter(Boolean).join(' · '),
      tone: !known || done ? 'neutral' : 'bad',
    });
  }
  if (h.lastOrderDate) {
    const st = h.lastOrderStatus ?? '';
    events.push({
      d: h.lastOrderDate,
      text: [`הזמנה ${shortDate(h.lastOrderDate)}`, st || null].filter(Boolean).join(' · '),
      tone: ORDER_OPEN.has(st) ? 'bad' : 'neutral',
    });
  }
  events.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  const last = events[0];
  const text = [...open, last?.text].filter(Boolean).join(' · ');
  if (!text) return { text: 'מוכר לנו, בלי אירועים רשומים', tone: 'new' };
  return { text, tone: open.length ? 'bad' : (last?.tone ?? 'neutral') };
}
