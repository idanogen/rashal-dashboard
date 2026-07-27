/**
 * סדר העצירות הקנוני של המערכת — מקור אמת אחד לכל המסכים.
 *
 * ההכרעה: שעת התיאום (timeWindowStart) היא המפתח הראשי. עצירות בלי שעה
 * יורדות לסוף. בין עצירות עם אותה שעה (או שתיהן ללא שעה) שובר-השוויון הוא
 * sequence — המספר הסידורי הידני שנשמר בגרירה/אופטימיזציה.
 *
 * כך גם היומן במחשב, גם מפת היום, גם דשבורד השיבוצים וגם אפליקציית הנהג
 * מציגים את אותו סדר בדיוק. אין יותר מסך שמראה סדר שונה ממסך אחר.
 *
 * הערה על גרירה ידנית: מכיוון ששעת התיאום מנצחת, גרירת עצירה של 09:00
 * מתחת לעצירה של 14:00 לא תשנה את הסדר (הלקוח מצפה בשעה שנקבעה). הגרירה
 * כן משפיעה על עצירות באותה שעה או בלי שעה. זו התנהגות מכוונת בעסק הזה,
 * שבו הנהג נוסע לפי שעת התור.
 */
export interface OrderableStop {
  timeWindowStart?: string;
  sequence?: number;
}

/** שובר-שוויון: לפי sequence כשקיים בשני הצדדים, אחרת יציב (0). */
function sequenceTiebreak(a: OrderableStop, b: OrderableStop): number {
  if (typeof a.sequence === 'number' && typeof b.sequence === 'number') {
    return a.sequence - b.sequence;
  }
  return 0;
}

/**
 * ה-comparator הקנוני. השתמש בו בכל מקום שממיין עצירות לתצוגה.
 * timeWindowStart בפורמט "HH:MM" ניתן להשוואה לקסיקוגרפית ישירה.
 */
export function compareStopsByTime(a: OrderableStop, b: OrderableStop): number {
  const ta = a.timeWindowStart;
  const tb = b.timeWindowStart;
  if (ta && tb) {
    const cmp = ta.localeCompare(tb);
    if (cmp !== 0) return cmp;
    return sequenceTiebreak(a, b);
  }
  if (ta) return -1; // ל-a יש שעה, ל-b אין → a קודם
  if (tb) return 1; // ל-b יש שעה, ל-a אין → b קודם
  return sequenceTiebreak(a, b); // לשניהם אין שעה
}
