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
  label: string;
  tone: MediaBadgeTone;
}

export function mediaBadge(state: string): MediaBadge | null {
  switch (state) {
    case 'media_received':
      return { label: '📷 תמונה התקבלה', tone: 'green' };
    case 'pending':
      return { label: 'בקשת תמונה בתור', tone: 'gray' };
    case 'first_sent':
      return { label: 'ממתין לתמונה', tone: 'amber' };
    case 'reminder_sent':
      return { label: 'תזכורת נשלחה, ממתין לתמונה', tone: 'amber' };
    case 'replied_no_media':
      return { label: 'ענה בלי תמונה', tone: 'blue' };
    case 'no_response':
      return { label: 'אין מענה לבקשת תמונה', tone: 'red' };
    case 'failed':
      return { label: 'שליחת בקשת תמונה נכשלה', tone: 'red' };
    case 'no_phone':
      return { label: 'אין נייד לבקשת תמונה', tone: 'gray' };
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
