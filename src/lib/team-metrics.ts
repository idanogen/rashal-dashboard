/**
 * המדדים של מסך הצוות, בלי ייבוא, ולכן נבדקים ביחידה.
 *
 * 🔴🔴 **"אחוז אספקות שבוצעו" הוא המדד שהכי קל לטעות בו כאן**, והטעות
 * פוגעת באנשים. מדידה של <bdi>90</bdi> יום (<bdi>02/09/2026</bdi>)
 * הראתה שרודי סוגר <bdi>75</bdi> עצירות מתוך <bdi>271</bdi> משובצות,
 * ואולג אפס מתוך <bdi>33</bdi>. הקריאה התמימה היא "רודי מבצע רבע
 * מהעבודה", והיא **שקר**: לרודי <bdi>156</bdi> עצירות שנשארו פתוחות
 * מימים שעברו, כלומר הוא נסע ולא סגר. אלה שתי שאלות שונות, אחת על
 * העבודה ואחת על הדיווח, ומסך שמערבב אותן מייצר שיחת משמעת על סמך מספר
 * שגוי.
 *
 * ⭐ **לכן המכנה הוא מה שנסגר, והפתוחות מוצגות בעמודה נפרדת** ולא
 * נבלעות. ⭐ ו**מי שאין לו מספיק ימי פעילות אינו מדורג בכלל**, כי ממוצע
 * על שלושה ימים אינו קצב אלא מקרה. [[model_from_one_cycle_is_a_guess]]
 */

export interface TeamPerson {
  name: string;
  kind: 'driver' | 'technician' | 'both' | null;
  stops: number;
  arrived: number;
  completed: number;
  notCompleted: number;
  openFromPast: number;
  activeDays: number;
  closedSameDay: number;
}

/** מתחת לזה לא מציגים קצב. שלושה ימים אינם מגמה. */
export const MIN_DAYS_FOR_RATE = 5;

export interface PersonRow extends TeamPerson {
  /** מתוך מה שנסגר, כמה נסגר כבוצע. null כשלא נסגר כלום */
  closeRate: number | null;
  /** עצירות שנסגרו ליום פעילות. null כשאין מספיק ימים */
  perDay: number | null;
  /** מתוך הסגורות, כמה נסגרו באותו יום. null כשאין סגורות */
  sameDayRate: number | null;
  /** ⭐ הדגל שמונע להסיק מאדם שכמעט לא נכח במערכת */
  tooFewDays: boolean;
}

export function toPersonRow(p: TeamPerson): PersonRow {
  const closed = p.completed + p.notCompleted;
  return {
    ...p,
    closeRate: closed > 0 ? (p.completed / closed) * 100 : null,
    perDay: p.activeDays >= MIN_DAYS_FOR_RATE ? closed / p.activeDays : null,
    sameDayRate: p.completed > 0 ? (p.closedSameDay / p.completed) * 100 : null,
    tooFewDays: p.activeDays < MIN_DAYS_FOR_RATE,
  };
}

/**
 * הסדר: מי שסגר הכי הרבה קודם, ומי שכמעט לא נכח יורד לתחתית.
 *
 * 🔴 **לא ממיינים לפי אחוז.** מי שסגר עצירה אחת מתוך אחת יקפוץ לראש
 * הרשימה מעל מי שסגר 237 מתוך 274, וזו בדיוק הצורה שבה טבלה מציגה
 * את הלא נכון ראשון. [[score_alone_is_not_the_signal]]
 */
export function orderPeople(rows: PersonRow[]): PersonRow[] {
  return [...rows].sort((a, b) => {
    const presence = Number(a.tooFewDays) - Number(b.tooFewDays);
    if (presence !== 0) return presence;
    return b.completed - a.completed;
  });
}

/**
 * מי שדורש התייחסות: הרבה פתוחות מימים שעברו.
 *
 * ⭐ הסף הוא מספר ולא אחוז. עשר עצירות פתוחות זה עשרה לקוחות שלא יודעים
 * מה קורה איתם, בלי קשר לכמה עצירות היו באותו חודש.
 */
export const OPEN_BACKLOG_ALERT = 10;

export function needsAttention(rows: PersonRow[]): PersonRow[] {
  // 🔴 הגדול קודם. ברשימה שממוינת לפי תפוקה, מי שיש לו 156 פתוחות היה
  // מופיע שלישי אחרי שניים עם 37, וזו בדיוק השורה שצריכה לקפוץ לעין.
  return rows
    .filter((r) => r.openFromPast >= OPEN_BACKLOG_ALERT)
    .sort((a, b) => b.openFromPast - a.openFromPast);
}

/** אחוז לתצוגה, או קו כשאין על מה לחשב. */
export function pct(v: number | null): string {
  return v === null ? '·' : `${Math.round(v)}%`;
}
