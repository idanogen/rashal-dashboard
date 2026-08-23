import type { InboxResponse } from './wa-inbox';
import type { QueryClient } from '@tanstack/react-query';

/**
 * מפתחות השאילתה וקצב הרענון של תיבת השיחות, במקום אחד.
 *
 * 🔴 **נולד מחשבון שנאכל.** הכפתור הצף והתיבה הפתוחה שאלו כל אחד לחוד
 * את אותה שאלה בדיוק, תחת שני מפתחות שונים, ולכן react-query לא איחד
 * ביניהם ונשלחו שתי בקשות זהות. במדידה של 23/08/2026 יצאו
 * **348 קריאות ל-`api/conversation` בשעה אחת**, שהן 99% מכל תעבורת
 * הפונקציות של כל הפרויקטים בחשבון, מול תיבה שיש בה 23 שורות.
 * מכסת ה-Active CPU החודשית עמדה על 75%.
 *
 * ⭐ **שלושה כללים שמחזיקים את זה:**
 * 1. **מפתח אחד לרשימה.** גם הכפתור וגם התיבה קוראים ל-`inboxKey`, ולכן
 *    כששניהם על אותה לשונית יוצאת בקשה אחת ולא שתיים.
 * 2. **המונה נקרא מהמטמון, לא מבקשה משלו.** כל תשובה של הרשימה נושאת
 *    `counts.waiting` בלי קשר ללשונית, אז לכפתור אין שום סיבה לשאול
 *    בעצמו כשהתיבה כבר פתוחה ושואבת.
 * 3. **השרשור נשאר מהיר.** שם באמת מחכים להודעה, ולכן הוא לא כפוף
 *    לקצב של הרשימה.
 */

/** תחילית משותפת. `invalidateQueries({queryKey:[WA_INBOX_KEY]})` מרענן הכל. */
export const WA_INBOX_KEY = 'wa-inbox';

/** מפתח הרשימה. אותה לשונית ואותו חיפוש = אותו מפתח = בקשה אחת. */
export function inboxKey(tab: 'waiting' | 'all', q: string) {
  return [WA_INBOX_KEY, tab, q] as const;
}

/** מפתח השרשור של לקוח יחיד. */
export function threadKey(phone: string | null) {
  return ['wa-thread', phone] as const;
}

/**
 * קצב הרענון של הרשימה ושל תג ההמתנה.
 * 🔴 שלוש דקות ולא דקה. מספר על תג לא צריך להיות טרי לדקה, וההפרש הוא
 * פי שלושה בחשבון.
 */
export const WA_INBOX_POLL_MS = 180_000;

/**
 * קצב הרענון של השרשור הפתוח.
 * ⭐ נשאר קצר בכוונה: זה המסך היחיד שבו עובד יושב ומחכה לתשובת לקוח.
 */
export const WA_THREAD_POLL_MS = 30_000;

/**
 * מספר הממתינים מתוך התשובה העדכנית ביותר של הרשימה, מכל לשונית שהיא.
 *
 * 🔴 **הטרייה ביותר מנצחת, ולא הראשונה שנמצאה.** במטמון יכולות לשבת
 * במקביל תשובות של "ממתינים", של "כל השיחות" ושל חיפוש, וכל אחת נושאת
 * `counts` נכון לרגע שבו היא נמשכה. בחירה שרירותית הייתה מציגה על התג
 * מספר ישן בזמן שהתיבה פתוחה ומעודכנת.
 *
 * מחזיר `null` כשעדיין לא הגיעה שום תשובה, כדי שאפשר יהיה להבדיל בין
 * "אין ממתינים" לבין "עוד לא יודעים".
 */
export function readWaitingCount(client: QueryClient): number | null {
  let newestAt = 0;
  let waiting: number | null = null;

  for (const query of client.getQueryCache().getAll()) {
    if (query.queryKey[0] !== WA_INBOX_KEY) continue;
    const data = query.state.data as InboxResponse | undefined;
    if (typeof data?.counts?.waiting !== 'number') continue;
    if (query.state.dataUpdatedAt >= newestAt) {
      newestAt = query.state.dataUpdatedAt;
      waiting = data.counts.waiting;
    }
  }

  return waiting;
}
