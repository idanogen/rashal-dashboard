/**
 * הדרך לפתוח שיחת וואטסאפ עם לקוח מתוך המערכת.
 *
 * 🔴🔴 **בגרסה הראשונה (<bdi>31/08/2026</bdi>) זה היה קישור `wa.me`,
 * ועידן פסל אותו ב-<bdi>02/09</bdi>: "אנחנו עובדים בוואטסאפ על המערכת
 * שלנו."** הוא צדק, וזו לא הערת נוחות. `wa.me` פותח וואטסאפ ווב **של
 * המשתמש**, כלומר השיחה יוצאת מהמספר הפרטי שלו, אינה נרשמת בתיבת
 * השיחות, אינה נספרת בחלון <bdi>24</bdi> השעות, ואף עובד אחר לא יראה
 * שדיברנו. הערוץ העסקי הוא התיבה שבמערכת, וכל מה שיוצא ממנו מתועד.
 *
 * ⭐ ולכן הקישור מוביל פנימה: `/inbox?phone=…`, והתיבה נפתחת על השיחה
 * של אותו לקוח.
 *
 * ⚠️ המספר מועבר **בצורה המקומית** (`0XXXXXXXXX`), כי זו הצורה שבה
 * `phone_local` שמור בשורות התיבה, וזו הצורה שהחיפוש שלה משווה מולה.
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */

/**
 * נייד ישראלי תקין בצורה מקומית, או null.
 *
 * 🔴 קו נייח מחזיר null, כי שיחת וואטסאפ אליו נראית תקינה על המסך
 * ונכשלת אצל הלקוח. המסך מציג "אין נייד" במקום כפתור שמבטיח ולא מקיים.
 */
export function waLocalPhone(phoneE164: string | null | undefined): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/\D/g, '');
  if (/^9725\d{8}$/.test(digits)) return '0' + digits.slice(3);
  if (/^05\d{8}$/.test(digits)) return digits;
  return null;
}

/** הנתיב לתיבת השיחות, פתוחה על הלקוח הזה. null כשאין נייד תקין. */
export function waInboxPath(phoneE164: string | null | undefined): string | null {
  const local = waLocalPhone(phoneE164);
  return local === null ? null : `/inbox?phone=${encodeURIComponent(local)}`;
}
