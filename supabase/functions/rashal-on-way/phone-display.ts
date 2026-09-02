// ─── מספר העובד כפי שהלקוח רואה אותו בהודעה ───────────────────────────────
//
// **הבקשה (שלומי, 01/09/2026):** שיהיה ללקוח דרך פשוטה להתקשר לנהג.
//
// ⭐ **ולא צריך כפתור בשביל זה.** וואטסאפ מזהה לבד מספרי טלפון בגוף ההודעה
// והופך אותם ללחיצים, גם בהודעת תבנית. מה שמחליש את הזיהוי הוא הפורמט
// המקומי: <bdi>058-5868780</bdi> נתפס אצל חלק מהמכשירים ולא אצל כולם,
// ובפורמט בינלאומי הזיהוי אמין כמעט תמיד.
//
// ⭐ **וזה משתנה שאנחנו ממלאים ולא נוסח התבנית**, ולכן אין הגשה מחדש למטא
// ואין סיכון לזרימה שרצה. כפתור חיוג אמיתי לא היה עוזר כאן בכל מקרה: מטא
// מחייבת שהמספר בכפתור יהיה קבוע בתבנית ואוסרת עליו להיות משתנה, כלומר
// הוא היה מחייג לאותו מספר לכל הנהגים.
//
// 🔴 **הכלל שמנחה את כל הפונקציה: מספר שלא זוהה בוודאות חוזר כמו שהוא.**
// מוטב שהלקוח יראה את הפורמט הישן מאשר מספר שעיוותנו, כי הודעה עם מספר
// שגוי גרועה מהודעה עם מספר פחות נוח.

/** אורך המנוי בישראל: שבע הספרות האחרונות. מה שלפניהן הוא הקידומת. */
const SUBSCRIBER = 7;

export function displayPhone(raw: string | null | undefined): string {
  const original = (raw ?? "").trim();
  if (!original) return "";

  const digits = original.replace(/\D/g, "");
  if (!digits) return original;

  // 972501234567 · +972501234567 · 00972501234567
  let local: string;
  if (digits.startsWith("972")) {
    local = digits.slice(3);
  } else if (digits.startsWith("00972")) {
    local = digits.slice(5);
  } else if (digits.startsWith("0")) {
    local = digits.slice(1);
  } else {
    // 🔴 לא ישראלי או לא מזוהה. לא נוגעים.
    return original;
  }

  // קידומת של ספרה או שתיים (מוקדים ונייד) ואחריה שבע ספרות מנוי.
  const prefixLen = local.length - SUBSCRIBER;
  if (prefixLen < 1 || prefixLen > 2) return original;

  const prefix = local.slice(0, prefixLen);
  const sub = local.slice(prefixLen);
  return `+972-${prefix}-${sub.slice(0, 3)}-${sub.slice(3)}`;
}
