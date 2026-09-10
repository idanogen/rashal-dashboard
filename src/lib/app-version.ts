/**
 * "הקוד שרץ אצלי הוא הקוד שבאוויר?"
 *
 * 🔴🔴 **הבעיה שזה פותר.** זהו יישום עמוד יחיד: לשונית שנשארת פתוחה לא
 * מורידה שוב את קובץ האפליקציה, גם כשמנווטים בין מסכים. משתמש יכול להריץ
 * קוד מלפני הפריסה במשך ימים, ורוב הזמן זה לא מזיק. זה כן מזיק ברגע
 * שהשרת או המסד משתנים מתחתיו.
 *
 * ⭐ **המקרה (<bdi>09/09/2026</bdi>):** נעילת הכסף במסד הורידה את ההרשאה
 * הטבלאית מ-`pickups`. הקוד החדש שולף עמודות מפורשות, הישן שלף `*` וחטף
 * דחייה. אצל מי שהלשונית שלו הייתה פתוחה מהבוקר, **פאנל האיסופים נשאר
 * ריק ונראה כמו "אין איסופים"**. שום דבר במסך לא אמר שמשהו נכשל.
 *
 * 🔴 **התשובה "לא הצלחתי לשאול" אינה "יש גרסה חדשה".** תקלת רשת, שרת
 * שמחזיר את `index.html` במקום את הקובץ, או פענוח שנכשל, כולם מחזירים
 * `null` ולא מרימים את הפס. פס רענון שקופץ על כל גמגום רשת יאבד את
 * האמון שלו תוך יום. [[silence_needs_a_positive_control]]
 */

/** מזהה הבנייה שהקוד הזה נבנה איתו. `dev` בפיתוח ובבדיקות. */
export const BUILD_ID: string =
  typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

/**
 * האם הקוד שרץ ישן.
 *
 * 🔴 היגיון טהור, בלי רשת ובלי דפדפן, כדי שיהיה אפשר לבדוק אותו. שלושת
 * מצבי ה"לא" חשובים כמו מצב ה"כן": בלי תשובה, בפיתוח, ובזהות.
 */
export function isStaleBuild(running: string, latest: string | null): boolean {
  if (!latest) return false
  if (!running || running === 'dev') return false
  return latest !== running
}

/**
 * שואל את השרת מה המזהה שבאוויר.
 *
 * 🔴 `cache: 'no-store'` **וגם** פרמטר משתנה בכתובת. בלעדיהם הדפדפן או
 * ה-CDN מחזירים את התשובה הישנה, וזו בדיוק אותה מחלה שהבדיקה אמורה לגלות.
 *
 * 🔴 בפיתוח אין `version.json`, ו-Vercel מחזיר את `index.html` לכל נתיב
 * שאינו קובץ. לכן פענוח שנכשל, או תשובה בלי `build`, הם `null` ולא שגיאה.
 */
export async function fetchLatestBuildId(
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const build = (body as { build?: unknown } | null)?.build
    return typeof build === 'string' && build ? build : null
  } catch {
    return null
  }
}

/**
 * ⭐ **שליפה שנכשלה היא הרמז הכי חזק שיש לנו.** במקום לחכות לסבב הבדיקה
 * הבא, כל כישלון שליפה מבקש בדיקת גרסה מיידית. ככה המשתמש שנפגע הוא גם
 * הראשון שרואה את הפס, ולא אחרי עשר דקות.
 *
 * מאורע דפדפן ולא ייבוא ישיר, כדי ששכבת המדידה לא תכיר את שכבת התצוגה.
 */
export const FETCH_FAILED_EVENT = 'rashal:fetch-failed'

export function announceFetchFailure(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FETCH_FAILED_EVENT))
}
