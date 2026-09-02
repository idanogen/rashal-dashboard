/**
 * ─── מי מייצג את קבוצת הכפילויות ─────────────────────────────────────────
 *
 * 🔴🔴 **הבאג (01/09/2026, מריצת ההשוואה של הבוקר):** המסכים הציגו רק את
 * **ראש** קבוצת הכפילויות, וההסתרה של הכפיל הייתה מוחלטת ולא מותנית בכלום.
 * ברגע שהראש נסגר או אורכב הוא ירד מהמסך, **ומי שנתלה עליו ירד איתו**.
 * נמדד באותו יום: <bdi>SO2601795</bdi> (בית נועם) תלוי ב-<bdi>SO2601794</bdi>
 * שאורכב בקו החותך, ו-<bdi>SC2601972</bdi> (בן נתן חיה) תלוי
 * ב-<bdi>SC2601971</bdi> שבוטל בפריוריטי. שתיהן פתוחות בפריוריטי, ולשתיהן
 * לא היה שום מסך שיציג אותן.
 *
 * ⭐ **הכלל שמחליף את ההסתרה המוחלטת:** כפיל מוסתר רק כל עוד יש לו מייצג
 * על המסך. אין ראש (לא נטען, כי אורכב או שנפל מחלון הטעינה) או שהראש
 * נסגר, והכפיל עצמו עדיין פתוח, הוא הופך לראש בעצמו.
 *
 * 🔴🔴 **וההעלאה מותנית בכך שהעבודה פתוחה גם בפריוריטי, בדיוק כמו הגלאי.**
 * בלי התנאי הזה נמדדו 30 שורות שהיו עולות לרשימה במקום 2: חמש טיוטות,
 * 14 שכבר "בוצעה" בפריוריטי (כלומר סופקו דרך הראש), ותשע שאריות של
 * ה-webhook הישן בלי מספר מסמך כלל, שהן דווקא **הכפילות האמיתית** שבשבילה
 * המנגנון נבנה. המסך והמייל של הבוקר חולקים מעכשיו כלל אחד, ולכן מה שמדווח
 * הוא מה שיופיע.
 *
 * 🔴 **כפיל סגור שהראש שלו סגור נשאר מוסתר בכוונה.** אין מה להציג עליו,
 * והעלאתו הייתה מזיזה מונים היסטוריים (סופק/בוצע) בלי שאיש ביקש.
 *
 * 🔴 **ו-`groupSize` סופר רק את מי שבאמת מוסתר תחת הראש.** באדג' ×N שסופר
 * גם כפיל שהועלה מבטיח כרטיס שני שכבר קיים בפני עצמו ברשימה.
 *
 * הקובץ בלי שום ייבוא, ולכן נבדק ביחידה (test/dedup-heads.test.mjs).
 */

export interface DedupAccessors<T> {
  /** המזהה שאליו מצביע `duplicateOf` של אחרים */
  getId: (row: T) => string;
  /** מזהה הראש, או undefined כשהשורה עצמה ראש */
  getDuplicateOf: (row: T) => string | undefined;
  /** האם השורה עדיין עבודה פתוחה אצלנו (לא סופק/בוצע/בוטל) */
  isOpen: (row: T) => boolean;
  /**
   * האם היא פתוחה גם בפריוריטי. רשומה בלי סטטוס פריוריטי כלל אינה פתוחה
   * לצורך הזה: אלה שאריות ה-webhook הישן, והן הכפילות האמיתית.
   */
  isOpenInPriority: (row: T) => boolean;
}

export interface DedupGroups<T> {
  /** מה שמוצג: ראשים אמיתיים + כפילים שאיבדו את המייצג שלהם */
  heads: T[];
  /** headId → גודל הקבוצה (הראש + הכפילים שנשארו מתחתיו) */
  groupSize: Map<string, number>;
  /** כמה שורות הוסתרו בפועל */
  hiddenCount: number;
}

export function resolveDedupGroups<T>(rows: T[], acc: DedupAccessors<T>): DedupGroups<T> {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(acc.getId(row), row);

  const heads: T[] = [];
  const hiddenUnder = new Map<string, number>();

  for (const row of rows) {
    const headId = acc.getDuplicateOf(row);
    if (!headId) {
      heads.push(row);
      continue;
    }

    const head = byId.get(headId);
    // יש מייצג על המסך: הכפיל נשאר מתחתיו, כמו תמיד.
    if (head !== undefined && acc.isOpen(head)) {
      hiddenUnder.set(headId, (hiddenUnder.get(headId) ?? 0) + 1);
      continue;
    }

    // אין מייצג פתוח. עבודה שפתוחה בשני הצדדים חייבת מסך, שאר המקרים לא.
    if (acc.isOpen(row) && acc.isOpenInPriority(row)) {
      heads.push(row);
    } else if (head !== undefined) {
      // ראש סגור עדיין נטען, ובמסכים ההיסטוריים הוא מוצג. הבאדג' שלו נשאר נכון.
      hiddenUnder.set(headId, (hiddenUnder.get(headId) ?? 0) + 1);
    }
  }

  const groupSize = new Map<string, number>();
  for (const [headId, n] of hiddenUnder.entries()) {
    groupSize.set(headId, n + 1); // +1 עבור הראש עצמו
  }

  return { heads, groupSize, hiddenCount: rows.length - heads.length };
}
