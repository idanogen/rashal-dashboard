/**
 * עיצוב שורת התיבה.
 *
 * ⭐ **מסך הפתיחה הוא "מי מחכה לתשובה", לא רשימת צ'אטים לפי זמן**
 * (החלטת עידן, 22/08/2026). זו לא העדפה ויזואלית: רשימה לפי זמן היא מה
 * שוואטסאפ ווב כבר עושה, בחינם ויותר טוב. מה שאין לו מקבילה הוא רשימת
 * הלקוחות שכתבו ולא נענו, לפי כמה זמן הם מחכים.
 *
 * 🔴 **לקובץ הזה אין ולו ייבוא יחסי אחד, וזה מכוון.** הייבוא בפרויקט
 * כתוב עם סיומת `.js` (דרישת הבנייה של Vercel), ו-Node לא פותר אותה
 * חזרה ל-`.ts` כשמריצים בדיקה ישירות על המקור. מודול טהור הוא מודול
 * שאפשר לבדוק, ובדיקה שאי אפשר להריץ שווה אפס.
 *
 * ⭐ **ולכן מצב החלון מגיע פנימה כפרמטר ולא מחושב כאן.** כלל 24 השעות
 * ממשיך לחיות במקום אחד בלבד, `_lib/thread.ts`, ואין כאן עותק שני שלו
 * שיסטה ממנו בשקט. השאילתה עצמה יושבת ב-`api/wa-inbox.ts`.
 */

/** מצב חלון 24 השעות, כפי שהוא מגיע מ-`_lib/thread.ts`. */
export interface WindowState {
  open: boolean;
  expiresAt: string | null;
  minutesLeft: number;
  reason: string | null;
}

export interface ConversationRow {
  id: string;
  phone_local: string | null;
  phone_e164: string | null;
  contact_name: string | null;
  customer_number: string | null;
  customer_name: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: string | null;
  unanswered_since: string | null;
  message_count: number | null;
}

export interface InboxItem {
  id: string;
  phone: string | null;
  /** השם שיוצג. לקוח מפריוריטי גובר על שם פרופיל הוואטסאפ. */
  title: string;
  customerNumber: string | null;
  /** true כשהשם מגיע מפרופיל הוואטסאפ ולא מהמחסן, כלומר טרם זוהה לקוח. */
  unidentified: boolean;
  preview: string;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  unansweredSince: string | null;
  /** כמה דקות הלקוח מחכה. null כשאין חוב מענה. */
  waitingMinutes: number | null;
  messageCount: number;
  window: WindowState;
}

/**
 * כמה זמן מחכים, בטקסט שאפשר לקרוא במבט.
 *
 * 🔴 **בלי עיגול לדקה שלמה.** "מחכה 0 דקות" נראה כמו באג, ולכן פחות
 * מדקה נאמר כ"עכשיו".
 */
export function waitLabel(minutes: number | null): string {
  if (minutes == null) return '';
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'יום' : days === 2 ? 'יומיים' : `${days} ימים`;
}

export function toItem(row: ConversationRow, win: WindowState, now = Date.now()): InboxItem {
  // ⭐ שם הלקוח מפריוריטי גובר. שם פרופיל הוואטסאפ הוא מה שהלקוח בחר
  // לעצמו, והוא לא בהכרח מה שהעובד מזהה. כשאין לקוח מזוהה, מה שיש הוא
  // שם הפרופיל, ואחריו המספר, ורק אז "לא מזוהה" כדי שלא תופיע שורה ריקה.
  const identified = Boolean(row.customer_number);
  const title =
    row.customer_name?.trim() ||
    row.contact_name?.trim() ||
    row.phone_local ||
    'לא מזוהה';

  const waitingMinutes = row.unanswered_since
    ? Math.max(0, Math.floor((now - new Date(row.unanswered_since).getTime()) / 60_000))
    : null;

  return {
    id: row.id,
    phone: row.phone_local,
    title,
    customerNumber: row.customer_number,
    unidentified: !identified,
    preview: (row.last_message_preview ?? '').trim(),
    lastMessageAt: row.last_message_at,
    lastMessageDirection: row.last_message_direction,
    unansweredSince: row.unanswered_since,
    waitingMinutes,
    messageCount: Number(row.message_count ?? 0),
    window: win,
  };
}

/**
 * מיון לפי הלשונית.
 *
 * 🔴 **בלשונית הממתינים, הוותיק ביותר למעלה.** זה הפוך מרשימת צ'אטים,
 * ובכוונה: מי שמחכה הכי הרבה הוא מי שהכי קרוב לנטוש את השיחה, ולא מי
 * שהכי טרי. מיון לפי טריות היה קובר בדיוק את המקרים שהמסך נועד לתפוס.
 *
 * ⭐ **ובתוך אותו זמן המתנה, שיחה בחלון פתוח קודמת.** שם עוד אפשר לענות
 * בטקסט חופשי, ואחרי שהחלון נסגר התשובה כפופה לתבנית מאושרת ולעלות.
 */
export function sortItems(items: InboxItem[], tab: 'waiting' | 'all'): InboxItem[] {
  const out = [...items];
  if (tab === 'waiting') {
    out.sort((a, b) => {
      const byWait = (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1);
      if (byWait !== 0) return byWait;
      if (a.window.open !== b.window.open) return a.window.open ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '', 'he');
    });
    return out;
  }
  out.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });
  return out;
}

/**
 * חיפוש חופשי על שורות התיבה.
 *
 * 🔴 **החיפוש רץ גם על המספר וגם על הטלפון וגם על תצוגת ההודעה האחרונה.**
 * עובד שמחפש לקוח מקליד מה שזכור לו, ולפעמים זה ארבע ספרות מהטלפון.
 * חיפוש שרץ על השם בלבד היה מחזיר אפס ונראה כמו "אין שיחה".
 *
 * 🔴 **והספרות מנורמלות.** `054-541` ו-`054541` הם אותו חיפוש, ומקף אחד
 * הוא ההבדל בין תוצאה לבין מסך ריק.
 */
export function matchesQuery(item: InboxItem, raw: string): boolean {
  const q = String(raw ?? '').trim().toLowerCase();
  if (!q) return true;

  const digits = q.replace(/\D/g, '');

  // 🔴 **שאילתה שכולה ספרות וקצרה משלוש נדחית.** בגרסה הראשונה היה כאן
  // "שומר" שבדק אורך רק במסלול המספרי, בזמן שחיפוש המחרוזת הרגיל כבר
  // התאים `54` לתוך `0545412903` שורה קודם. כלומר השומר היה מת, ובדיקה
  // היא זו שגילתה. שתי ספרות מחזירות חצי מהתיבה, וזה נראה כמו חיפוש שבור.
  if (digits.length === q.length && digits.length < 3) return false;

  const haystack = [item.title, item.customerNumber, item.phone, item.preview]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes(q)) return true;
  if (digits.length >= 3) {
    const numeric = [item.customerNumber, item.phone].filter(Boolean).join(' ').replace(/\D/g, '');
    if (numeric.includes(digits)) return true;
  }
  return false;
}
