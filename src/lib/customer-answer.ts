/**
 * המשפט שהנציג אומר ללקוח, ושפת הוודאות של הכרטיס.
 *
 * ⭐ **הלב של המסך יושב כאן ולא ברכיב.** עידן ביקש שכשלקוח מתקשר יהיה
 * "כל המידע מול העיניים, כולל האם יש משלוח פתוח ואם כן האם הוא שובץ
 * לאספקה". התשובה הזאת נבנית בקוד, פעם אחת, ולכן היא יכולה להיבדק.
 *
 * 🔴 **ולקובץ הזה אין ולו ייבוא אחד, וזה מכוון.** הייבוא בפרויקט כתוב
 * עם סיומת `.js`, ו-Node לא פותר אותה חזרה ל-`.ts` כשמריצים בדיקה
 * ישירות על המקור. מודול טהור הוא מודול שאפשר לבדוק, ובדיקה שאי אפשר
 * להריץ שווה אפס.
 */

export type MatchKind = 'number' | 'phone' | 'name' | 'document' | 'phone-part';

export interface OpenItem {
  id: string;
  ref: string | null;
  status: string | null;
  created: string | null;
  match: MatchKind | null;
  archived?: boolean;
  scheduled: boolean;
  date: string | null;
  driver: string | null;
  winStart?: string | null;
  winEnd?: string | null;
  coordination?: string | null;
  /** הסטטוס והיומן לא מסכימים. ראה `mismatchNote`. */
  mismatch?: boolean;
  items?: unknown;
  device?: string | null;
  fault?: string | null;
}

export interface AnswerLine {
  /** המשפט עצמו. */
  text: string;
  /** ok = יש תשובה טובה · warn = מחכה ואינו משובץ · none = אין פתוח. */
  tone: 'ok' | 'warn' | 'none';
}

const DAY_MS = 86400000;

/** כמה ימים עברו. `null` כשאין תאריך. */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** "לפני 9 ימים" · "היום" · "אתמול". */
export function agoLabel(iso: string | null | undefined, now = Date.now()): string {
  const d = daysSince(iso, now);
  if (d == null) return '';
  if (d === 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 30) return `לפני ${d} ימים`;
  const m = Math.floor(d / 30);
  return m === 1 ? 'לפני חודש' : `לפני ${m} חודשים`;
}

/** יום בשבוע + תאריך, כמו שאומרים ללקוח בטלפון. */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `יום ${names[d.getDay()]} ${dd}/${mm}`;
}

/** חלון השעות, כשיש. */
export function windowLabel(start?: string | null, end?: string | null): string {
  const cut = (v?: string | null) => (v ? String(v).slice(0, 5) : '');
  const a = cut(start);
  const b = cut(end);
  if (a && b) return `${a} עד ${b}`;
  if (a) return `מ-${a}`;
  return '';
}

/**
 * המשפט שהנציג אומר.
 *
 * 🔴 **"שובץ" נגזר מהעצירה ביומן ולא מהסטטוס.** נמדד ב-24/08/2026:
 * 16 הזמנות מסומנות "תואמה אספקה" בלי שום עצירה, 9 מבוטלות עם עצירה
 * פעילה, ו-25 קריאות סגורות עם עצירה פתוחה. שני מנגנונים שמתארים אותו
 * דבר יסטו זה מזה, ולכן המסך מציג את מה שקיים ביומן בפועל.
 */
export function answerLine(
  orders: OpenItem[],
  calls: OpenItem[],
  now = Date.now(),
): AnswerLine {
  const scheduled = orders.find((o) => o.scheduled);
  if (scheduled) {
    const win = windowLabel(scheduled.winStart, scheduled.winEnd);
    const parts = [`שובץ ל${dayLabel(scheduled.date)}`];
    if (scheduled.driver) parts.push(`נהג ${scheduled.driver}`);
    if (win) parts.push(win);
    // ⭐ המשפט נאמר בקול. "יש משלוח פתוח (ועוד 1)" אינו משפט שאדם אומר
    // בטלפון, ולכן הריבוי נכתב במילים.
    const head = orders.length > 1
      ? `יש ${orders.length} משלוחים פתוחים, אחד מהם`
      : 'יש משלוח פתוח,';
    return { text: `${head} ${parts.join(', ')}.`, tone: 'ok' };
  }

  if (orders.length) {
    const oldest = orders
      .map((o) => daysSince(o.created, now))
      .filter((d): d is number => d != null)
      .sort((a, b) => b - a)[0];
    const wait = oldest == null ? '' : ` ממתין ${oldest === 1 ? 'יום' : `${oldest} ימים`}.`;
    const many = orders.length > 1 ? `${orders.length} משלוחים פתוחים` : 'יש משלוח פתוח';
    return { text: `${many}, עדיין לא שובצו לאספקה.${wait}`, tone: 'warn' };
  }

  const callScheduled = calls.find((c) => c.scheduled);
  if (callScheduled) {
    return {
      text: `אין משלוח פתוח. קריאת שירות שובצה ל${dayLabel(callScheduled.date)}${
        callScheduled.driver ? `, ${callScheduled.driver}` : ''
      }.`,
      tone: 'ok',
    };
  }
  if (calls.length) {
    const oldest = daysSince(calls[0].created, now);
    return {
      text: `אין משלוח פתוח. יש קריאת שירות פתוחה שלא שובצה${
        oldest == null ? '' : `, ${agoLabel(calls[0].created, now)}`
      }.`,
      tone: 'warn',
    };
  }
  return { text: 'אין ללקוח הזה שום פריט פתוח.', tone: 'none' };
}

/**
 * מה לומר כשהסטטוס והיומן לא מסכימים.
 *
 * ⭐ **נאמר במפורש ולא נבלע.** זו עבודה אמיתית שממתינה, והמסך הוא מה
 * שחושף אותה.
 */
export function mismatchNote(item: OpenItem): string | null {
  if (!item.mismatch) return null;
  return item.scheduled
    ? `יש עצירה ביומן, והסטטוס בפריוריטי הוא "${item.status ?? ''}".`
    : `הסטטוס בפריוריטי הוא "${item.status ?? ''}", אבל אין שום עצירה ביומן.`;
}

/**
 * שפת הוודאות.
 *
 * 🔴 **רשומה שנתפסה לפי שם היא השערה, והמסך אומר את זה.** בלי זה,
 * שני לקוחות עם אותו שם היו מתמזגים לתיק אחד בלי שאיש ידע.
 */
export function matchLabel(kind: MatchKind | null | undefined): string | null {
  if (kind === 'phone') return 'זוהה לפי טלפון';
  if (kind === 'name') return 'זוהה לפי שם';
  return null;
}

export interface MatchCounts {
  byNumber: number;
  byPhone: number;
  byName: number;
}

/**
 * המשפט שמסביר כמה מההיסטוריה כאן ודאית.
 * מוצג רק כשיש באמת התאמות רכות, אחרת הוא רעש.
 */
export function certaintyNote(m: MatchCounts | null | undefined): string | null {
  if (!m) return null;
  const soft = (m.byPhone ?? 0) + (m.byName ?? 0);
  if (soft === 0) return null;
  const bits: string[] = [];
  if (m.byPhone) bits.push(`${m.byPhone} לפי טלפון`);
  if (m.byName) bits.push(`${m.byName} לפי שם`);
  const head = soft === 1 ? 'רשומה אחת כאן חוברה' : `${soft} רשומות כאן חוברו`;
  return `${head} ללקוח בלי מספר לקוח: ${bits.join(' ו-')}.`;
}
