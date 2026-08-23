/**
 * מי נכלל בכלל אבטחה, לפי הביטוי שלו.
 *
 * ⭐ **קובץ בלי שום ייבוא**, כדי שהסיווג יהיה נבדק ביחידה. זה הלב של מסך
 * ההרשאות: אם הסיווג טועה, המסך מציג ביטחון שאין לו כיסוי.
 *
 * 🔴 **וביטוי שלא זוהה מוחזר כ-`unknown` ולעולם לא מדולג.** מדיניות
 * שנופלת בשקט מהמסך נראית בדיוק כמו מדיניות שלא קיימת, וזה הכיוון
 * המסוכן: המסך היה מציג "סגור" על משהו פתוח.
 */

export type Audience =
  | 'anyone'      // כל מי שמחובר
  | 'staff'       // מנהל מערכת · מנהל צוות · סדרן
  | 'managers'    // מנהל מערכת · מנהל צוות
  | 'admin'       // מנהל מערכת בלבד
  | 'viewer'      // צפייה בלבד
  | 'driverOwn'   // נהג, ורק על מה ששלו
  | 'self'        // המשתמש על עצמו
  | 'service'     // שרתים בלבד, לא בני אדם
  | 'unknown';

export const AUDIENCE_LABELS: Record<Audience, string> = {
  anyone: 'כל מי שמחובר',
  staff: 'מנהל מערכת · מנהל צוות · סדרן',
  managers: 'מנהל מערכת · מנהל צוות',
  admin: 'מנהל מערכת בלבד',
  viewer: 'צפייה בלבד',
  driverOwn: 'נהג, רק מה ששלו',
  self: 'המשתמש על עצמו',
  service: 'שרתים בלבד',
  unknown: '🔴 לא זוהה, לבדוק ידנית',
};

export interface PolicyRow {
  policy: string;
  cmd: string;
  roles: string[];
  expr: string;
}

/** מדיניות שחלה על `service_role` בלבד אינה נגישה לאף אדם. */
function serviceOnly(roles: string[]): boolean {
  return roles.length > 0 && roles.every((r) => r === 'service_role');
}

export function classifyPolicy(p: PolicyRow): Audience {
  if (serviceOnly(p.roles)) return 'service';

  const e = p.expr.replace(/\s+/g, ' ').trim();

  // 🔴 הסדר חשוב: נהג נבדק לפני "צפייה", כי ביטוי הנהג מכיל גם
  // `current_user_role()` וגם השוואת עצירה, והתאמה חלקית הייתה מרחיבה
  // אותו בטעות לכל מי שמחובר.
  if (e.includes('current_user_driver()') || /current_user_role\(\)\s*=\s*'driver'/.test(e)) {
    return 'driverOwn';
  }
  if (e.includes('is_admin_or_dispatcher()')) return 'staff';
  if (e.includes('can_manage_team()')) return 'managers';
  if (e.includes('is_admin()')) return 'admin';
  if (/current_user_role\(\)\s*=\s*'viewer'/.test(e)) return 'viewer';
  if (/auth\.uid\(\)\s*=\s*id|id\s*=\s*auth\.uid\(\)/.test(e)) return 'self';
  if (e === 'true') return 'anyone';
  return 'unknown';
}

export type Access = 'read' | 'write';

/** האם המדיניות פותחת קריאה, כתיבה, או שתיהן. */
export function policyAccess(cmd: string): Access[] {
  const c = cmd.toUpperCase();
  if (c === 'SELECT') return ['read'];
  if (c === 'ALL') return ['read', 'write'];
  return ['write']; // INSERT · UPDATE · DELETE
}

export interface TableRow {
  tbl: string;
  rls_enabled: boolean;
  policies: PolicyRow[];
}

export interface TableVerdict {
  tbl: string;
  /** קהל ⟵ מה מותר לו */
  byAudience: Map<Audience, Set<Access>>;
  /** 🔴 טבלה בלי אף מדיניות סגורה לכל אדם, ורק השרתים מגיעים אליה. */
  closedToPeople: boolean;
  /** 🔴 RLS כבוי פירושו שהטבלה פתוחה לגמרי, בלי קשר למדיניות. */
  rlsOff: boolean;
  hasUnknown: boolean;
}

export function summarizeTable(t: TableRow): TableVerdict {
  const byAudience = new Map<Audience, Set<Access>>();
  for (const p of t.policies) {
    const a = classifyPolicy(p);
    const set = byAudience.get(a) ?? new Set<Access>();
    for (const acc of policyAccess(p.cmd)) set.add(acc);
    byAudience.set(a, set);
  }
  const humanPolicies = t.policies.filter((p) => !serviceOnly(p.roles));
  return {
    tbl: t.tbl,
    byAudience,
    closedToPeople: humanPolicies.length === 0,
    rlsOff: !t.rls_enabled,
    hasUnknown: [...byAudience.keys()].includes('unknown'),
  };
}

/** דירוג חשיפה, למיון: מה שפתוח לכולם קודם. */
export function exposureRank(v: TableVerdict): number {
  if (v.rlsOff) return 0;
  const a = v.byAudience.get('anyone');
  if (a?.has('write')) return 1;
  if (a?.has('read')) return 2;
  if (v.hasUnknown) return 3;
  if (v.closedToPeople) return 9;
  return 5;
}
