// סיומת מפורשת: גם node --test (בדיקות היחידה) וגם vite פותרים אותה.
import { matchesSearch } from './search-match.ts';

/**
 * היסטוריית ביקורים עם חיפוש (בקשת עמי, 30/08/2026).
 *
 * שני צרכנים:
 * - אפליקציית הנהג: ברירת המחדל נשארת 7 ימים אחורה, אבל ברגע שמקלידים
 *   חיפוש הוא רץ על **כל** ההיסטוריה של הנהג (מה שה-RLS נותן לו, כלומר
 *   רק שלו), כולל "לא בוצע" עם הסיבה.
 * - כרטיס הלקוח של עמי: תווית "ביקור אחרון" עם הדגשה כשהוא טרי.
 *
 * 🔴 "מי ביקר" קיים רק ביומן שלנו, מ-22/04/2026 והלאה. פריוריטי לא
 * יודעת איזה נהג נסע, ולכן החיפוש לא יכול להעמיק מעבר לזה.
 */

export interface VisitStopLike {
  deliveryDate: string; // YYYY-MM-DD
  status: string;
  /** מי ביצע. מ-02/09/2026 יכול להיות עובד אחר, ראה `mine` למטה. */
  driver?: string;
  customerName: string;
  customerNumber?: string;
  address?: string;
  city?: string;
  phone?: string;
  notes?: string;
  resolutionNote?: string;
}

export interface VisitDay<T> {
  date: string;
  stops: T[];
}

function stopHaystack(s: VisitStopLike): string {
  return [
    s.customerName,
    s.customerNumber,
    s.address,
    s.city,
    s.phone,
    s.notes,
    s.resolutionNote,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * בונה את רשימת ימי ההיסטוריה של הנהג, מהחדש לישן.
 *
 * בלי חיפוש: רק ימים מ-`floorDate` (כולל) ועד אתמול, כל העצירות.
 * עם חיפוש: **כל** הימים שלפני היום, ורק עצירות שמתאימות לשאילתה
 * (כל המילים, בכל סדר, אותם כללים כמו חיפוש הסדרן). יום בלי התאמות
 * לא מוצג.
 *
 * 🔴🔴 **`mine` נוסף ב-02/09/2026, כשהנהג התחיל לראות גם ביקורים של
 * עובדים אחרים אצל לקוח שהוא נוסע אליו.** בלי ההפרדה קרו שני דברים רעים:
 * ביקורים של עמיתים היו נכנסים לרשימת "השבוע האחרון שלי" ולמונים שלה,
 * כלומר **הסטטיסטיקה של הנהג הייתה סופרת עבודה של אחרים**; ומי שהסתכל
 * בכרטיס לא היה יודע שהביקור בכלל לא שלו.
 * ⭐ **לכן ביקור של אחר מופיע רק בתוצאות חיפוש**, שהוא הרגע שבו הנהג
 * שואל "מה היה כאן קודם", ולעולם לא בתצוגת ברירת המחדל.
 */
export function buildVisitHistory<T extends VisitStopLike>(
  entries: Iterable<[string, T[]]>,
  opts: { today: string; floorDate: string; query: string; mine?: string }
): VisitDay<T>[] {
  const q = opts.query.trim();
  const isMine = (s: T) => !opts.mine || !s.driver || s.driver === opts.mine;
  const result: VisitDay<T>[] = [];
  for (const [date, stops] of entries) {
    if (date >= opts.today) continue;
    if (!q && date < opts.floorDate) continue;
    const kept = q
      ? stops.filter((s) => matchesSearch(stopHaystack(s), q))
      : stops.filter(isMine);
    if (kept.length > 0) result.push({ date, stops: kept });
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export interface VisitRecency {
  days: number;
  /** "היום" · "אתמול" · "לפני X ימים" · תאריך מלא כשזה רחוק */
  label: string;
  /** טרי = 30 יום אחורה. זה מה שמודגש אצל עמי. */
  recent: boolean;
}

export const RECENT_VISIT_DAYS = 30;

/** ימים בין שני תאריכי YYYY-MM-DD, בלי תלות בשעון ובאזור זמן. */
export function visitRecency(visitDate: string, today: string): VisitRecency {
  const ms =
    Date.parse(today + 'T00:00:00Z') - Date.parse(visitDate + 'T00:00:00Z');
  const days = Math.round(ms / 86_400_000);
  const label =
    days <= 0
      ? 'היום'
      : days === 1
        ? 'אתמול'
        : days <= RECENT_VISIT_DAYS
          ? `לפני ${days} ימים`
          : `ב-${visitDate.slice(8, 10)}/${visitDate.slice(5, 7)}/${visitDate.slice(2, 4)}`;
  return { days, label, recent: days <= RECENT_VISIT_DAYS };
}

/** YYYY-MM-DD בשעון מקומי. לא toISOString, זה קופץ יום קדימה בלילה. */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** תווית תוצאת הביקור כפי שהיא מוצגת ליד "ביקור אחרון". */
export function visitOutcomeLabel(outcome: string | null | undefined): string {
  if (outcome === 'completed') return 'בוצע';
  if (outcome === 'not_completed') return 'לא בוצע';
  return '';
}
