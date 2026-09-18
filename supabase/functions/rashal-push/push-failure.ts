/**
 * סיווג כשל בכתיבה לפריוריטי (18/09/2026).
 *
 * 🔴 שני כשלים שנראים אותו דבר: "פריוריטי לא זמין עכשיו" (לנסות שוב) מול
 * "פריוריטי לא יקבל את זה לעולם" (לעצור). בלי ההבחנה, פריט אחד שנדחה
 * ניסה 450 פעמים ביומיים והחזיק את ה-job באדום. [[dead_letter]]
 *
 * 🔴 קובץ טהור בלי ייבוא, כדי שייבדק (`test/push-failure.test.mjs`).
 */

/** נוסח השגיאה של פריוריטי, מתוך עטיפת ה-XML-כ-JSON שהוא מחזיר. */
export function priorityErrorText(body: string): string | null {
  // הנוסח האמיתי: {"?xml":…,"FORM":{"@TYPE":"DOCUMENTS_Q","InterfaceErrors":{"@XmlFormat":"0","text":"…"}}}
  const direct = /"InterfaceErrors"\s*:\s*\{[^}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  if (direct) return JSON.parse(`"${direct[1]}"`);
  const odata = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  if (odata) return JSON.parse(`"${odata[1]}"`);
  return null;
}

/**
 * האם הדחייה סופית. 4xx של תוכן = פריוריטי הבין ואמר לא.
 * 401 (סיסמה/הרשאה) ו-429 (מכסה) הם מצב רגעי שמסתדר בלי שינוי בתוכן,
 * ולכן ממשיכים לנסות; 5xx ותקלת רשת גם.
 */
export function isPermanentRejection(status: number | null | undefined): boolean {
  if (!status || status < 400 || status >= 500) return false;
  return ![401, 408, 429].includes(status);
}

/** סיבת העצירה, לשורה ביומן ולמייל. */
export function parkReason(errorText: string | null): string {
  if (errorText && /לקריאה בלבד|לא ניתן לעדכון/.test(errorText)) return 'read_only_subform';
  return 'priority_rejected';
}

/**
 * שורת השגיאה שנרשמת בסיכום הריצה.
 * 🔴 הנוסח של פריוריטי קודם, ורק אחריו ה-XML: החיתוך ל-150 תווים בגרסה
 * הקודמת עצר בדיוק לפני המשפט שמסביר מה קרה, ולכן המייל אמר "HTTP 400"
 * ותו לא. [[error_text_names_its_author]]
 */
export function failureLine(eventId: string, status: number | null | undefined, body: string): string {
  const text = priorityErrorText(body);
  const head = status ? `HTTP ${status}` : 'ללא תשובה';
  return `${eventId}: ${head} · ${(text ?? body).slice(0, 180)}`;
}
