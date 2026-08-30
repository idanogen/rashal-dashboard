/**
 * החיווי של מנוע "תמונה לפני טכנאי" על כרטיס הקריאה (בקשת עמי, 30/08/2026).
 *
 * הצבע נושא את ההכרעה: ירוק = יש תמונה, אפשר לתאם טכנאי. ענבר = הבקשה
 * בדרך או ממתינה. אדום = הלקוח לא הגיב גם לתזכורת, או שהשליחה נכשלה,
 * ובשני המקרים אדם צריך להרים טלפון. כחול = הלקוח ענה בלי תמונה ואדם
 * צריך להיכנס לשיחה. מצבים שאין בהם מה לעשות (בוטל, דולג) לא מוצגים,
 * כי צבע על הכל הוא לא צבע. [[color_on_everything_is_not_color]]
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */

export type MediaBadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export interface MediaBadge {
  /** עד שתי מילים — הכרטיס צפוף והצבע נושא את רוב המשמעות (עידן, 30/08). */
  label: string;
  /** המשפט המלא, לטולטיפ. */
  long: string;
  tone: MediaBadgeTone;
}

export function mediaBadge(state: string): MediaBadge | null {
  switch (state) {
    case 'media_received':
      return { label: '📷 תמונה התקבלה', long: 'הלקוח שלח תמונה או סרטון של התקלה', tone: 'green' };
    case 'pending':
      return { label: 'תמונה בתור', long: 'בקשת תמונה ממתינה לשליחה', tone: 'gray' };
    case 'first_sent':
      return { label: 'ממתין לתמונה', long: 'נשלחה ללקוח בקשת תמונה, טרם ענה', tone: 'amber' };
    case 'reminder_sent':
      return { label: 'נשלחה תזכורת', long: 'נשלחה תזכורת, עדיין ממתין לתמונה', tone: 'amber' };
    case 'replied_no_media':
      return { label: 'ענה בלי תמונה', long: 'הלקוח ענה בטקסט בלי תמונה, כדאי להיכנס לשיחה', tone: 'blue' };
    case 'no_response':
      return { label: 'אין מענה', long: 'אין מענה לבקשת התמונה גם אחרי התזכורת, כדאי להתקשר', tone: 'red' };
    case 'failed':
      return { label: 'שליחה נכשלה', long: 'שליחת בקשת התמונה נכשלה, כנראה אין וואטסאפ על המספר', tone: 'red' };
    case 'no_phone':
      return { label: 'אין נייד', long: 'אין מספר נייד לשליחת בקשת תמונה', tone: 'gray' };
    default:
      // cancelled · skipped · מצב עתידי שלא הוגדר: אין פעולה, אין צבע.
      return null;
  }
}

export const MEDIA_BADGE_CLASS: Record<MediaBadgeTone, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-slate-100 text-slate-600',
};
