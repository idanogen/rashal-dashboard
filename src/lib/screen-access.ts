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

const STAFF: UserRole[] = ['admin', 'team_manager', 'dispatcher', 'viewer'];
const MANAGERS: UserRole[] = ['admin', 'team_manager'];

export const SCREEN_ACCESS: ScreenAccess[] = [
  { path: '/',                 label: 'בית',              group: 'daily', allow: STAFF },
  { path: '/orders',           label: 'דשבורד הזמנות',     group: 'daily', allow: STAFF },
  { path: '/dispatch',         label: 'מסך סדרן',          group: 'daily', allow: STAFF },
  { path: '/inbox',            label: 'שיחות וואטסאפ',     group: 'daily', allow: STAFF },
  { path: '/feedback',         label: 'הערות',            group: 'daily', allow: [...STAFF, 'driver'] },
  // 🔴 מנהל מערכת בלבד (עידן, 23/08/2026). המסך מרכז מספרים של ההנהלה,
  // ולא כל מי שרואה את מסך הסדרן אמור לראות אותם.
  { path: '/overview',         label: 'דשבורד הנהלה',      group: 'admin', allow: ['admin'] },
  { path: '/inspections',      label: 'בדיקות מנופים',     group: 'admin', allow: STAFF },
  { path: '/whatsapp',         label: 'וואטסאפ (ישן)',     group: 'admin', allow: STAFF },
  { path: '/admin/users',      label: 'משתמשים',          group: 'admin', allow: MANAGERS },
  { path: '/admin/team',       label: 'צוות השטח',         group: 'admin', allow: MANAGERS },
  { path: '/admin/permissions', label: 'הרשאות',          group: 'admin', allow: MANAGERS },
  { path: '/admin/wa-templates', label: 'תבניות וואטסאפ', group: 'admin', allow: ['admin'] },
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
