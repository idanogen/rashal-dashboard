// מי משובץ לקריאה → DOCUMENTS_Q.TOPP_DRIVERNAME ("שם נהג / טכנאי"). עידן, 13/11/2026.
//
// החלטה: השם נכתב ברגע השיבוץ (וגם כשמחליפים טכנאי), לא בסיום הביקור. השדה החדש
// מחליף את "לטיפול" (TECHNICIANLOGIN), שקיבל רק משתמש פעיל ודחה את רוב הטכנאים.
// ✅ אומת חי 13/11 (SC2603599): טקסט חופשי בלי קישור ל-USERS. "מוהנד", שאין לו
//    משתמש בפריוריטי, נכתב ונקרא חזרה. הכתיבה לא מזיזה סטטוס ולא STATUSDATE.
// 🔴 רוחב השדה 15 תווים (ייצוא עמודות המסך, 13/11). שם ארוך נחתך כאן, לפני הכתיבה,
//    כדי שהקריאה החוזרת תשווה מול מה שבאמת נשלח.
// 🔴 קובץ טהור בלי ייבוא, כדי שייבדק ב-node (`test/driver-name.test.mjs`).

export const DRIVER_FIELD = "TOPP_DRIVERNAME";
export const DRIVER_FIELD_WIDTH = 15;

/** הערך שנכתב לשדה: השם אצלנו (calendar_stops.driver), מנוקה וחתוך לרוחב השדה. ריק = אין מה לכתוב. */
export function driverFieldValue(name: string | null | undefined): string {
  return (name ?? "").trim().slice(0, DRIVER_FIELD_WIDTH).trim();
}

export type DriverWriteOutcome = "done" | "failed" | "retry";

/**
 * מה עושים עם שורה אחרי ה-PATCH.
 * retry = תקלה זמנית (408, 429, 5xx), השורה נשארת ממתינה לריצה הבאה.
 * failed = פריוריטי דחתה (4xx), או שהקריאה החוזרת לא מחזירה את מה שנכתב. לא חוזרים על
 * זה לנצח: השורה נעצרת עם הנוסח, והוואצ'דוג מתריע. [[retry-forever-turns-the-alarm-into-noise]]
 */
export function classifyDriverWrite(http: number, wanted: string, readBack: string | null): DriverWriteOutcome {
  if (http === 408 || http === 429 || http >= 500) return "retry";
  if (http !== 200 && http !== 204) return "failed";
  return (readBack ?? "").trim() === wanted ? "done" : "failed";
}
