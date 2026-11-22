/**
 * הסינונים הפעילים במסך הסדרן (22/11/2026).
 *
 * 🔴 הרקע: עמי לא ראה את כל המידע ולא הצליח לזהות איזה סינון פעיל אצלו.
 * סינון הקופה וסינון הסוגים ביומן נזכרים בדפדפן ושורדים רענון, והחיוויים
 * שלהם היו מפוזרים בשלושה מקומות במסך. מכאן נגזר פס אחד שמופיע רק כשמשהו
 * מסונן, ומה שנרשם ללוגים כדי שנוכל לראות את זה מרחוק.
 *
 * 22/11 (עידן, אחרי הפריסה): "חייבים שכל הסינונים יופיעו שם". נוספו רמזור
 * הקריאות, ושלוש הסתרות של ברירת מחדל שאף אחד לא בחר אבל הן מסתירות רשומות:
 * לקוחות חדשים שיש להם הזמנה, אדומות מעל שבועיים, וכפילויות מפריוריטי.
 *
 * קובץ טהור, בלי ייבוא, כדי שייבדק ב-node --test.
 */

export type FilterKey = 'fund' | 'zones' | 'lights' | 'types' | 'collapsed' | 'search' | 'calendarSearch';

export interface FilterState {
  /** חיפוש בממתינים */
  search: string;
  /** שמות האזורים שנבחרו */
  zoneLabels: string[];
  /** שם הקופה שנבחרה, או null */
  fundLabel: string | null;
  /** שמות הסוגים שמוסתרים ביומן */
  hiddenTypeLabels: string[];
  /** חיפוש ביומן */
  calendarSearch: string;
  /** צבעי הרמזור שנבחרו בקריאות השירות */
  lightLabels: string[];
  /** אזורים מקופלים שמסתירים רשומות (רשימת ממתינים, נהגים ביומן). נזכר בדפדפן. */
  collapsedLabels: string[];
  /** הסתרות ברירת המחדל שעדיין מסתירות (לרישום בלוגים בלבד) */
  defaultsOn: DefaultKey[];
}

/** הסתרות שאף אחד לא בחר: ברירת המחדל של המסך. מוצגות בפס כדי שיהיה ברור מה לא מוצג. */
export type DefaultKey = 'withOrder' | 'oldRed' | 'duplicates';

export interface DefaultHiding {
  key: DefaultKey;
  label: string;
  count: number;
}

const DEFAULT_LABEL: Record<DefaultKey, string> = {
  withOrder: 'לקוחות חדשים שכבר יש להם הזמנה או קריאה',
  oldRed: 'קריאות אדומות מעל שבועיים',
  duplicates: 'כפילויות מפריוריטי',
};

/** רק הסתרות שבאמת מסתירות משהו עכשיו (ספירה מעל אפס), בסדר קבוע. */
export function defaultHidings(counts: Partial<Record<DefaultKey, number>>): DefaultHiding[] {
  return (['withOrder', 'oldRed', 'duplicates'] as const)
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => ({ key: k, label: DEFAULT_LABEL[k], count: counts[k] ?? 0 }));
}

export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

const MAX_QUERY = 18;

function quote(q: string): string {
  const t = q.trim();
  return `"${t.length > MAX_QUERY ? t.slice(0, MAX_QUERY) + '…' : t}"`;
}

/** הסינונים הפעילים, בסדר קבוע: קודם אלה שנזכרים בדפדפן. */
export function activeFilters(s: FilterState): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (s.fundLabel) out.push({ key: 'fund', label: `קופה: ${s.fundLabel}` });
  if (s.hiddenTypeLabels.length > 0) {
    out.push({ key: 'types', label: `מוסתרים ביומן: ${s.hiddenTypeLabels.join(', ')}` });
  }
  if (s.zoneLabels.length > 0) {
    const shown = s.zoneLabels.slice(0, 2).join(', ');
    const more = s.zoneLabels.length - 2;
    out.push({ key: 'zones', label: `אזור: ${shown}${more > 0 ? ` ועוד ${more}` : ''}` });
  }
  if (s.collapsedLabels.length > 0) out.push({ key: 'collapsed', label: `מקופל: ${s.collapsedLabels.join(', ')}` });
  if (s.lightLabels.length > 0) out.push({ key: 'lights', label: `רמזור: ${s.lightLabels.join(', ')}` });
  if (s.search.trim()) out.push({ key: 'search', label: `חיפוש: ${quote(s.search)}` });
  if (s.calendarSearch.trim()) out.push({ key: 'calendarSearch', label: `חיפוש ביומן: ${quote(s.calendarSearch)}` });
  return out;
}

export interface FilterCounts {
  /** ממתינים שמוצגים בטאב הנוכחי אחרי כל הסינונים */
  pendingShown: number;
  /** ממתינים בטאב הנוכחי בלי שום סינון */
  pendingTotal: number;
  /** עצירות מהיום והלאה שהסינון מסתיר ביומן */
  calendarHidden: number;
}

/** שורת המספרים בפס. מחזיר רק את החלקים שסינון פעיל באמת משפיע עליהם. */
export function filterSummary(active: ActiveFilter[], c: FilterCounts): string {
  const keys = new Set(active.map((a) => a.key));
  const parts: string[] = [];
  if (keys.has('fund') || keys.has('zones') || keys.has('lights') || keys.has('search')) {
    parts.push(`ממתינים: ${c.pendingShown.toLocaleString('he-IL')} מתוך ${c.pendingTotal.toLocaleString('he-IL')}`);
  }
  if ((keys.has('fund') || keys.has('types') || keys.has('calendarSearch')) && c.calendarHidden > 0) {
    parts.push(
      c.calendarHidden === 1
        ? 'ביומן מוסתרת עצירה אחת מהיום והלאה'
        : `ביומן מוסתרות ${c.calendarHidden.toLocaleString('he-IL')} עצירות מהיום והלאה`
    );
  }
  return parts.join(' · ');
}

/**
 * מה שנרשם ללוגים: אילו סינונים פעילים, בלי תוכן. שם הקופה, שמות האזורים
 * והסוגים הם ערכים מרשימה סגורה; טקסט החיפוש לא נרשם, רק שהוא קיים.
 */
export function filterTelemetry(s: FilterState): Record<string, unknown> {
  return {
    fund: s.fundLabel,
    hiddenTypes: s.hiddenTypeLabels,
    zones: s.zoneLabels,
    search: s.search.trim().length > 0,
    calendarSearch: s.calendarSearch.trim().length > 0,
    lights: s.lightLabels,
    collapsed: s.collapsedLabels,
    defaultsOn: s.defaultsOn,
  };
}

/** מה שהמשתמש בחר בעצמו, בלי הסתרות ברירת המחדל: רק זה מפעיל רישום בכניסה למסך. */
export function hasUserFilters(s: FilterState): boolean {
  return activeFilters(s).length > 0;
}

/** מפתח יציב להשוואה: האם מצב הסינון השתנה מאז הרישום האחרון. */
export function filterSignature(s: FilterState): string {
  return JSON.stringify(filterTelemetry(s));
}

/** כמה עצירות לא מבוטלות יש מהיום והלאה, לספירת מה שהסינון מסתיר ביומן. */
export function countFromToday<T extends { status: string; deliveryDate: string }>(
  stops: T[],
  today: string,
  keep?: (s: T) => boolean
): number {
  let n = 0;
  for (const s of stops) {
    if (s.status === 'cancelled' || s.deliveryDate < today) continue;
    if (keep && !keep(s)) continue;
    n++;
  }
  return n;
}
