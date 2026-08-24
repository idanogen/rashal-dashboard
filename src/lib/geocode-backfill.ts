/**
 * מי מתוך העצירות באמת צריך חיפוש כתובת, וכמה.
 *
 * 🔴 **נולד מבזבוז שנמדד.** מסך הסדרן הריץ השלמת מיקומים על **כל** עצירה
 * פעילה בלי נקודה מדויקת, ובמדידה של 23/08/2026 יצאו מזה **83 בקשות בכל
 * טעינת מסך, 77 מהן לעצירות בתאריך שכבר עבר**, הוותיקה מ-22/04. כל בקשה
 * כזאת גם מחייבת אותנו אצל גוגל.
 *
 * ⭐ **שני חסמים, וכל אחד חותך משפחת בזבוז אחרת:**
 * 1. **תאריך.** לעצירה שכבר קרתה אין מפה לצייר. היא לא תשובץ ולא תנווט
 *    אליה איש, ולכן אין שום ערך בכתובת מדויקת שלה.
 * 2. **צינון אחרי כישלון.** כתובת שלא נמצאה היום לא תימצא בטעינה הבאה.
 *    בלי צינון, כתובת משובשת נוסתה שוב ושוב לנצח, כי כישלון לא נרשם.
 *
 * 🔴 **הקובץ הזה בלי שום ייבוא בכוונה**, כדי שאפשר יהיה לבדוק אותו
 * ביחידה בלי לגרור את הלקוח של Supabase.
 */

/**
 * מה שההחלטה נשענת עליו, ובנוסף `city` שאינו משתתף בהכרעה אבל נוסע
 * הלאה אל החיפוש עצמו. הטיפוס מכיל רק שדות אופציונליים מעבר לחובה,
 * ולכן כל `CalendarStop` מתאים לו בלי המרה.
 */
export interface GeocodeCandidate {
  id: string;
  status: string;
  deliveryDate: string; // YYYY-MM-DD
  address?: string;
  city?: string;
  geocodedAddress?: string;
  geocodedAt?: string;
}

/** כמה זמן לא מנסים שוב כתובת שנכשלה. */
export const RETRY_COOLDOWN_DAYS = 30;

/** תאריך מקומי כ-YYYY-MM-DD. `toISOString` היה מזיז יום שלם באזור שלנו. */
export function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * העצירות שראוי לחפש להן כתובת עכשיו.
 *
 * `today` ו-`now` מוזרקים ולא נקראים מהשעון, כדי שהבדיקה תוכל לקבע רגע.
 */
export function selectForGeocode(
  stops: GeocodeCandidate[],
  today: string,
  now: number,
  alreadyTried: ReadonlySet<string> = new Set(),
): GeocodeCandidate[] {
  const cooldownMs = RETRY_COOLDOWN_DAYS * 86_400_000;

  return stops.filter((s) => {
    if (s.status !== 'planned' && s.status !== 'in_progress') return false;
    if (!s.address || !s.address.trim()) return false;

    // 🔴 החסם שחתך 77 מתוך 83. עצירה שכבר קרתה לא צריכה פין.
    if (!s.deliveryDate || s.deliveryDate < today) return false;

    // כבר יש לה נקודה מדויקת לכתובת הנוכחית.
    if (s.geocodedAddress === s.address) return false;

    // ⭐ חותמת בלי כתובת תואמת פירושה ניסיון שנכשל. מכבדים צינון.
    if (s.geocodedAt) {
      const t = Date.parse(s.geocodedAt);
      if (Number.isFinite(t) && now - t < cooldownMs) return false;
    }

    // ניסינו כבר בטעינה הנוכחית של המסך.
    if (alreadyTried.has(s.id)) return false;

    return true;
  });
}
