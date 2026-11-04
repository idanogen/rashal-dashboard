// מי טיפל בקריאה → DOCUMENTS_Q.TECHNICIANLOGIN ("לטיפול"). עידן, 04/11/2026.
//
// החלטה: השם נכתב בסיום הביקור אצל הלקוח, יחד עם הסטטוס, באותו PATCH. לא בשיבוץ.
// 🔴 הערך הוא שם משתמש בפריוריטי (USERS.USERLOGIN), לא שם חופשי. המיפוי יושב
//    ב-`assignees.priority_login` (מסך הצוות), והרשימה החיה ב-`priority_users`
//    (נמשכת פעם ביום בימי עבודה). שם שלא עובר את שניהם לא נכתב, ונרשם לפעמון.
// 🔴 קובץ טהור בלי ייבוא, כדי שייבדק ב-node (`test/technician-login.test.mjs`).

/** סטטוסים שבהם הטכנאי באמת היה אצל הלקוח. "לא בוצע" לא מגיע לכאן בכלל. */
export const VISIT_STATUSES = ["בוצעה", "להמשך טיפול"];

export type TechnicianDecision = { login: string; skip?: undefined } | { login?: undefined; skip: string };

/**
 * @param technician   השם אצלנו (calendar_stops.driver)
 * @param loginByName  assignees.name → priority_login (ריק = אין מיפוי)
 * @param knownLogins  רשימת המשתמשים מפריוריטי; null = הרשימה לא זמינה, מאמתים רק בקריאה חוזרת
 */
export function decideTechnician(
  technician: string | null | undefined,
  loginByName: ReadonlyMap<string, string | null>,
  knownLogins: ReadonlySet<string> | null,
): TechnicianDecision {
  const name = (technician ?? "").trim();
  if (!name) return { skip: "אין טכנאי על העצירה" };
  const login = (loginByName.get(name) ?? "").trim();
  if (!login) return { skip: `לטכנאי "${name}" אין שם משתמש בפריוריטי (העמודה "משתמש פריוריטי" במסך הצוות)` };
  if (knownLogins && !knownLogins.has(login)) {
    return { skip: `שם המשתמש "${login}" של ${name} לא קיים ברשימת המשתמשים של פריוריטי` };
  }
  return { login };
}

/** תאריך שעון ישראל (YYYY-MM-DD) ויום בשבוע (0 = ראשון), בלי ספריות. */
export function israelDay(now: Date): { day: string; dow: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
  const day = fmt.format(now);
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return { day, dow };
}

/**
 * האם מושכים היום את רשימת המשתמשים. עידן 04/11: פעם ביום, בימי עבודה בלבד
 * (ראשון עד חמישי), "נחסוך קצת קריאות". בשישי ושבת עובדים מול המטמון של חמישי.
 * @param lastSeenAt  seen_at האחרון ב-priority_users (null = אף פעם)
 */
export function usersRefreshDue(now: Date, lastSeenAt: Date | null): boolean {
  const { day, dow } = israelDay(now);
  if (dow === 5 || dow === 6) return false;
  if (!lastSeenAt) return true;
  return israelDay(lastSeenAt).day < day;
}
