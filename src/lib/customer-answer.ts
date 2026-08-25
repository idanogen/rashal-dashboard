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

/** dd/mm, לאירוע שכבר קרה. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
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
    // ⭐ יחיד ורבים. "יש משלוח פתוח, עדיין לא שובצו" הוא בדיוק סוג
    // המשפט שמסגיר שהמסך נכתב על ידי מכונה.
    const many = orders.length > 1
      ? `יש ${orders.length} משלוחים פתוחים, עדיין לא שובצו לאספקה.`
      : 'יש משלוח פתוח, עדיין לא שובץ לאספקה.';
    return { text: `${many}${wait}`, tone: 'warn' };
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

/* ───────────────────────────────────────────────────────────
 * מה יש אצל הלקוח עכשיו
 *
 * ⭐ **הבקשה של עידן (25/08/2026):** "הייתי רוצה שישר יקפוץ לנציגה איזה
 * מוצר יש ללקוח." לכן זה משפט, ולא רק רשימה: משפט אפשר לומר בטלפון.
 * ─────────────────────────────────────────────────────────── */

export type StockSource = 'delivery' | 'service' | 'register';

export interface StockItem {
  part: string | null;
  desc: string | null;
  qty: number;
  serials: string[];
  installedAt: string | null;
  warrantyEnd: string | null;
  lastSeen: string | null;
  sources: StockSource[];
  match: MatchKind | null;
}

export interface CustomerStock {
  devices: StockItem[];
  accessories: StockItem[];
  returned: { part: string | null; desc: string | null; at: string | null }[];
  since: string | null;
}

/**
 * שם הפריט כפי שאומרים אותו.
 *
 * 🔴 **`part` הוא `null` כשבפריוריטי נרשם טקסט חופשי** (`'*'`), למשל
 * "חגורת פרפר". 167 שורות כאלה. בלי הנפילה חזרה לתיאור, הנציגה הייתה
 * רואה שורה ריקה.
 */
export function itemTitle(item: { part: string | null; desc: string | null }): string {
  const desc = (item.desc ?? '').replace(/^"+|"+$/g, '').trim();
  if (item.part) return item.part;
  return desc || 'פריט';
}

/** התיאור, כשהוא מוסיף מידע מעבר לשם. */
export function itemSubtitle(item: { part: string | null; desc: string | null }): string {
  const desc = (item.desc ?? '').replace(/"{2,}/g, '"').replace(/^"+|"+$/g, '').trim();
  if (!item.part) return '';
  return desc;
}

export type WarrantyTone = 'active' | 'ending' | 'expired' | 'unknown';

/**
 * מצב האחריות.
 *
 * 🔴 **"נגמרת בקרוב" הוא סף ולא קישוט.** צבע שמופיע על כל פריט מפסיק
 * להיות צבע, ואז שום דבר לא בולט. [[color_on_everything_is_not_color]]
 * הסף כאן: 60 יום.
 */
export function warrantyState(
  end: string | null | undefined,
  now = Date.now(),
): { tone: WarrantyTone; text: string } {
  if (!end) return { tone: 'unknown', text: '' };
  const t = new Date(end).getTime();
  if (!Number.isFinite(t)) return { tone: 'unknown', text: '' };
  const days = Math.floor((t - now) / DAY_MS);
  const label = new Date(end).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (days < 0) return { tone: 'expired', text: `האחריות פגה ב-${label}` };
  if (days <= 60) return { tone: 'ending', text: `האחריות נגמרת ב-${label}` };
  return { tone: 'active', text: `באחריות עד ${label}` };
}

const SOURCE_TEXT: Record<StockSource, string> = {
  service: 'קריאת שירות',
  delivery: 'אספקה',
  register: 'מרשם המנופים',
};

/**
 * מאיפה אנחנו יודעים שהפריט שם.
 *
 * 🔴 **פריט בלי מקור הוא בדיוק מה שנציגה תגיד בביטחון ותיפול עליו.**
 * קריאת שירות היא העדות החזקה ביותר (טכנאי ראה את המכשיר), ולכן היא
 * נאמרת ראשונה.
 */
export function sourceLabels(sources: StockSource[] | null | undefined): string[] {
  const order: StockSource[] = ['service', 'delivery', 'register'];
  return order.filter((s) => (sources ?? []).includes(s)).map((s) => SOURCE_TEXT[s]);
}

/**
 * המשפט על הציוד.
 *
 * ⭐ נאמר בקול: "יש לו מנוף G175, מספר סידורי 17517098728, באחריות עד
 * 12/01/2028."
 *
 * 🔴 **וכשאין כלום, המשפט אומר למה.** רשימה ריקה נראית בדיוק כמו פיצ'ר
 * שלא הותקן, והנציגה לא יכולה לדעת אם ללקוח אין ציוד או שאנחנו לא
 * יודעים. [[empty_state_must_speak]]
 */
export function stockLine(stock: CustomerStock | null | undefined, now = Date.now()): AnswerLine {
  const devices = stock?.devices ?? [];
  const accessories = stock?.accessories ?? [];
  const returned = stock?.returned ?? [];

  if (devices.length) {
    const first = devices[0];
    const parts = [`יש לו ${itemTitle(first)}`];
    if (first.serials.length === 1) parts.push(`מספר סידורי ${first.serials[0]}`);
    const w = warrantyState(first.warrantyEnd, now);
    if (w.tone === 'active' || w.tone === 'ending') parts.push(w.text);
    else if (w.tone === 'expired') parts.push('האחריות כבר פגה');
    const rest = devices.length - 1;
    // ⭐ יחיד ורבים. "יש לו מנוף (ועוד 1)" אינו משפט שאדם אומר בטלפון.
    const tail = rest === 0 ? '' : rest === 1 ? ' ועוד מכשיר אחד.' : ` ועוד ${rest} מכשירים.`;
    return { text: `${parts.join(', ')}.${tail}`, tone: 'ok' };
  }

  if (accessories.length) {
    const names = accessories.slice(0, 2).map(itemTitle).join(' ו-');
    const rest = accessories.length - Math.min(2, accessories.length);
    return {
      text: `אין מכשיר רשום, יש ${names}${rest ? ` ועוד ${rest} פריטים` : ''}.`,
      tone: 'none',
    };
  }

  if (returned.length) {
    const last = returned[0];
    // 🔴 **תאריך בלבד, בלי יום בשבוע.** `dayLabel` נועד לתיאום עתידי
    // ("שובץ ליום רביעי"), ובעבר הוא מייצר "ב-יום שלישי 26/05", שאיש
    // לא אומר. אותו ניסוח בדיוק קיים בתוסף.
    return {
      text: `אין ציוד אצלו כרגע. מה שהיה נאסף בחזרה, האחרון ${itemTitle(last)}${
        last.at ? ` ב-${shortDate(last.at)}` : ''
      }.`,
      tone: 'none',
    };
  }

  // 🔴 הגבול נאמר במפורש, ומהמסד. תאריך קשיח כאן היה נשאר נכון עד
  // לייבוא ההיסטורי ואז משקר בשקט.
  const since = stock?.since
    ? new Date(stock.since).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  return {
    text: since
      ? `לא רשום אצלנו ציוד. אנחנו יודעים מה סופק ומה נאסף מ-${since} ואילך, וציוד ישן יותר יופיע רק אם נפתחה עליו קריאת שירות.`
      : 'לא רשום אצלנו ציוד אצל הלקוח הזה.',
    tone: 'none',
  };
}

/**
 * מה לומר כשהלקוח לא זוהה לפי הטלפון שממנו הוא כותב.
 *
 * 🔴🔴 **נתפס חי ב-25/08/2026:** לקוחה כתבה ממספר שאינו רשום בפריוריטי,
 * והכרטיס אמר "לא מזוהה" ו"לא רשום אצלנו ציוד" על לקוחה שיש לה מנוף
 * שסופק שבוע קודם. לקוחות ר.שעל הם מטופלים, ומי שכותב בוואטסאפ הוא
 * לרוב בן משפחה עם טלפון אחר.
 *
 * ⭐ אבל החיבור נאמר בקול, כי הוא בין טלפון אחד לשם.
 */
export function identityNote(
  c: { identifiedBy?: string | null; identifiedHint?: string | null; phone?: string | null } | null | undefined,
): string | null {
  if (!c || c.identifiedBy !== 'survey') return null;
  // ⭐ "ל" נדבקת לשם, בלי מקף. "ל-אלחרר פרלה" נראה כמו טקסט שנתפר במכונה.
  return `הטלפון הזה אינו רשום בפריוריטי. חיברנו אותו ${
    c.identifiedHint ? `ל${c.identifiedHint}` : 'ללקוח'
  } לפי סקר ששלחנו למספר הזה.`;
}
