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

// ─── רענון לבד ברגע בטוח (עידן, 13/10/2026) ─────────────────────────────────
//
// עידן: "אם אנחנו יודעים שהלקוח לא עובד על הגרסה העדכנית, אנחנו לא יכולים
// לרענן עבורו?". אפשר, אבל רענון מוחק כל מה שלא נשמר (טיוטת הודעה, חלון
// פתוח, חתימה). לכן רק ברגע בטוח, והפס נשאר לרגע הלא בטוח:
//   · הלשונית ברקע: מיד, אם אין בה חלון פתוח או טיוטה.
//   · מעבר מסך בתפריט: טעינה מלאה של המסך החדש (ב-`useAppVersion`).
//   · גלוי, שתי דקות בלי פעילות, בלי חלון פתוח ובלי טקסט בתיבת כתיבה.

/** כמה זמן בלי הקלדה, לחיצה או גלילה עד שמסך גלוי נחשב "לא בשימוש". */
export const AUTO_RELOAD_IDLE_MS = 2 * 60 * 1000

/**
 * 🔴 שומר לולאה: אחרי רענון לבד לגרסה מסוימת, לא מרעננים לבד שוב לאותה
 * גרסה בעשר הדקות הבאות. אם ה-CDN עדיין מגיש את הקוד הישן, בלי השומר
 * הלשונית הייתה מרעננת את עצמה כל עשר שניות. במקרה כזה נשאר רק הפס.
 */
export const AUTO_RELOAD_GUARD_MS = 10 * 60 * 1000

export interface PageState {
  hidden: boolean
  idleMs: number
  /** חלון (דיאלוג, גיליון) פתוח. שם יושבים טפסים וחתימות. */
  openDialog: boolean
  /** טקסט בתיבת כתיבה (textarea, עורך). טיוטה שתימחק. */
  draftText: boolean
}

export type AutoReloadReason = 'hidden' | 'idle'

/** האם מותר לרענן עכשיו, ולמה. null = לא, להשאיר את הפס. */
export function autoReloadReason(s: PageState): AutoReloadReason | null {
  // 🔴 גם ברקע: מי שעבר ללשונית אחרת באמצע הודעה חוזר לטיוטה, לא למסך ריק.
  if (s.openDialog || s.draftText) return null
  if (s.hidden) return 'hidden'
  if (s.idleMs >= AUTO_RELOAD_IDLE_MS) return 'idle'
  return null
}

export interface ReloadGuard {
  build: string
  at: number
}

/** האם השומר מתיר רענון לבד לגרסה הזאת. */
export function guardAllows(latest: string, guard: ReloadGuard | null, now: number): boolean {
  if (!guard || guard.build !== latest) return true
  return now - guard.at >= AUTO_RELOAD_GUARD_MS
}

/** פענוח בטוח של השומר מ-sessionStorage. כל דבר לא צפוי = אין שומר. */
export function parseGuard(raw: string | null): ReloadGuard | null {
  if (!raw) return null
  try {
    const g = JSON.parse(raw) as { build?: unknown; at?: unknown }
    return typeof g.build === 'string' && typeof g.at === 'number' ? { build: g.build, at: g.at } : null
  } catch {
    return null
  }
}
