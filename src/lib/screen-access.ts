import type { UserRole } from '@/types/profile';

/**
 * מי מגיע לאיזה מסך.
 *
 * 🔴 **זה המקור היחיד, וגם הנתב וגם מסך ההרשאות קוראים ממנו.** רשימה
 * שנייה שמתארת את אותו דבר מתיישנת בשקט ברגע שמישהו משנה ראוט, ומסך
 * הרשאות שמתיישן גרוע ממסך שלא קיים.
 */

export type ScreenGroup = 'daily' | 'admin' | 'field';

export interface ScreenAccess {
  path: string;
  label: string;
  group: ScreenGroup;
  allow: UserRole[];
}

const STAFF: UserRole[] = ['admin', 'management', 'team_manager', 'dispatcher', 'viewer'];
const MANAGERS: UserRole[] = ['admin', 'team_manager'];
/**
 * 🔴 **מי רואה כסף.** עידן, 26/08/2026: הנהלה בלבד, שהם שלומי ורונן.
 * ⭐ והאכיפה האמיתית במסד (`is_management()`), כי מסך שרק מסתיר אינו הגנה.
 */
const MONEY: UserRole[] = ['admin', 'management'];

export const SCREEN_ACCESS: ScreenAccess[] = [
  { path: '/',                 label: 'בית',              group: 'daily', allow: STAFF },
  // ⭐ הבוקר שלי (25/11/2026): המסך של אילונה, היעד השבועי ומה מחכה לשיבוץ. בתפריט רק למי שזה מסך הבית שלו ולמנהל מערכת.
  { path: '/my-day',           label: 'הבוקר שלי',         group: 'daily', allow: STAFF },
  { path: '/orders',           label: 'דשבורד הזמנות',     group: 'daily', allow: STAFF },
  { path: '/dispatch',         label: 'מסך סדרן',          group: 'daily', allow: STAFF },
  { path: '/inbox',            label: 'שיחות וואטסאפ',     group: 'daily', allow: STAFF },
  // ⭐ נקודת הכניסה כשלקוח מתקשר. 🔴 נהג אינו נכלל: הוא רואה את הנסיעה
  // שלו, לא את התיק המלא של הלקוח. אותה הכרעה נאכפת גם ב-`is_office_staff`
  // שבמסד, כי מסך שרק מסתיר כפתורים אינו הגנה.
  { path: '/customer',         label: 'כרטיס לקוח',        group: 'daily', allow: STAFF },
  // ⭐ משימות למשרד (08/10/2026): כל צוות המשרד, כולל צפייה בלבד, כי הנציגות הן viewer.
  { path: '/tasks',            label: 'משימות',            group: 'daily', allow: STAFF },
  // ⭐ רכש לקריאות שחזרו מהקו (15/11/2026): העמוד של אלכס מחסן ובית מלאכה. כל המשרד רואה; הקישור בתפריט רק למי שרשום על שולחן ולמנהל מערכת.
  { path: '/parts',            label: 'רכש לקריאות',       group: 'daily', allow: STAFF },
  // ⭐ ארכיון קריאות (18/11/2026): מה שירד מרשימת הסדרן לפי הסטטוס בפריוריטי. החזרה דורשת סדרן/מנהל (RLS).
  { path: '/calls-archive',    label: 'ארכיון',            group: 'daily', allow: STAFF },
  // ⭐ צ'אט צוות (09/10/2026): הודעה ישירה בין עובדים. הנהג מקבל באפליקציה.
  { path: '/chat',             label: 'צ\'אט צוות',         group: 'daily', allow: STAFF },
  // 🔴 **הוסב ב-27/08/2026 מ"מנהל מערכת בלבד" למי שרואה כסף.**
  // עד אז שלומי היה חייב להיות מנהל מערכת מלא רק כדי לראות את המסך,
  // כלומר גם ניהול משתמשים וגם תבניות. עכשיו יש תפקיד ביניים.
  // ⭐ 09/09/2026: נפתח גם למנהלי צוות (עמי, אבירם) בהחלטת עידן. הכסף
  // שהיה במסך (חשבוניות) מוסתר למי שאינו MONEY, ונחסם במסד לפני כן.
  { path: '/overview',         label: 'דשבורד הנהלה',      group: 'admin', allow: ['admin', 'management', 'team_manager'] },
  // 🔴 גיול חובות הוא כסף במובן הכי מובהק, ולכן הנהלה בלבד. ⭐ והאכיפה
  // אינה כאן אלא ב-RLS של `consolidated_invoices`: ה-RPC הוא
  // `security invoker`, ולכן מי שאינו מורשה מקבל רשימה ריקה מהמסד עצמו.
  { path: '/collections',      label: 'גיול חובות וגבייה', group: 'admin', allow: MONEY },
  // ⭐ **הסקרים בנפרד, ובכוונה.** עמי ביקש לראות סקרים, ואי אפשר פשוט
  // לפתוח לו את דשבורד ההנהלה כי יש עליו גם כסף. שביעות רצון אינה כסף.
  { path: '/surveys',          label: 'סקרי שביעות רצון',  group: 'daily', allow: STAFF },
  /**
   * ⭐ **ביצועי הצוות: הנהלה ומנהל צוות בלבד** (02/09/2026). זה אינו כסף,
   * ולכן הוא לא נופל תחת MONEY, אבל הוא **מדדים על אנשים בשמם**, וזו
   * סיבה עצמאית לא לפתוח אותו לכל המשרד. הנהג עצמו אינו נכלל.
   */
  { path: '/performance',      label: 'ביצועי הצוות',      group: 'admin', allow: ['admin', 'management', 'team_manager'] },
  // ⭐ דוח בוקר (09/09/2026): מה סופק אתמול, מה לא ולמה, והמגמה. אותם
  // מדדים על אנשים בשמם כמו ביצועי הצוות, ולכן אותה הרשאה בדיוק.
  { path: '/morning',          label: 'דוח בוקר',          group: 'admin', allow: ['admin', 'management', 'team_manager'] },
  { path: '/inspections',      label: 'בדיקות מנופים',     group: 'admin', allow: STAFF },
  // ⭐ דוח איסופים לקופה (שלומי 17/11, עידן 18/11/2026): הקובץ שעובר לקופה ב-10 לחודש, משני מקורות בתקופת ההרצה. ת"ז של מבוטחים, לכן המשרד בלבד.
  { path: '/pickups-report',   label: 'דוח איסופים לקופה', group: 'admin', allow: STAFF },
  // הדגמה בלבד, שום דבר לא נשמר (25/10/2026, לפני המסירה לעמי).
  { path: '/forms-demo',       label: 'הדגמת טפסים',       group: 'admin', allow: ['admin', 'management', 'team_manager'] },
  { path: '/whatsapp',         label: 'וואטסאפ (ישן)',     group: 'admin', allow: STAFF },
  { path: '/admin/users',      label: 'משתמשים',          group: 'admin', allow: MANAGERS },
  { path: '/admin/team',       label: 'צוות השטח',         group: 'admin', allow: MANAGERS },
  { path: '/admin/permissions', label: 'הרשאות',          group: 'admin', allow: MANAGERS },
  { path: '/admin/wa-templates', label: 'תבניות וואטסאפ', group: 'admin', allow: ['admin'] },
  // ⭐ חדר הבקרה של האוטומציות (30/08/2026): צפייה למי שרואה כסף,
  // והמתג עצמו נאכף במסד למנהל מערכת בלבד.
  { path: '/admin/wa-automations', label: 'אוטומציות וואטסאפ', group: 'admin', allow: MONEY },
  // ⭐ לוגים של תקופת ההרצה (02/11/2026): עידן בלבד, בהחלטתו. מדדים על אנשים
  // בשמם ברמת המסך והשגיאה, ולכן גם ה-RLS של `app_events` לאדמין בלבד.
  { path: '/admin/app-logs',   label: 'מי נתקע היום',       group: 'admin', allow: ['admin'] },
  { path: '/route-navigation', label: 'ניווט מסלול',       group: 'field', allow: [...STAFF, 'driver'] },
  { path: '/driver',           label: 'מסך הנהג',          group: 'field', allow: ['driver'] },
];

const BY_PATH = new Map(SCREEN_ACCESS.map((s) => [s.path, s]));

/**
 * ה-`allow` של ראוט. 🔴 זורק על נתיב שאינו ברשימה, כדי שהוספת מסך בלי
 * לרשום אותו כאן תתפוצץ מיד ולא תיעלם ממסך ההרשאות בשקט.
 */
export function screenAllow(path: string): UserRole[] {
  const s = BY_PATH.get(path);
  if (!s) throw new Error(`screenAllow: המסך ${path} אינו רשום ב-SCREEN_ACCESS`);
  return s.allow;
}
