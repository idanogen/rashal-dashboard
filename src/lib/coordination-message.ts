/**
 * הודעת תיאום ההגעה ללקוח: הנוסח, המשתנים והתשובות.
 *
 * ⭐ **מודול אחד לשלושת הצרכנים**: התצוגה המקדימה בדיאלוג, הערכים
 * שנשלחים ל-heyy, והפירוש של מה שהלקוח החזיר. שלושתם היו נכתבים
 * בנפרד, ואז המסך מראה שעה אחת וללקוח יוצאת אחרת.
 * [[screen_and_sender_must_share_one_module]] · [[confirmation_text_built_in_code]]
 *
 * 🔴 **אין כאן חריץ לטקסט חופשי, וזו הכרעה ולא השמטה.** מטא מסווגת
 * תבנית שיכולה לשאת כל טקסט כדיוור, גם כשהנוסח נצמד לעסקה. נמדד אצלנו
 * על שלוש תבניות באותו יום: זו היחידה שנשארה שירות היא זו שכל משתנה בה
 * מוגבל. ההערה של הסדרן נשמרת לעצירה ואינה יוצאת ללקוח.
 *
 * 🔴 **הנוסח כאן חייב להיות זהה לתבנית שאושרה ב-heyy**, כי הוא רק
 * תצוגה מקדימה. מה שבאמת יוצא ללקוח הוא הגוף ששמור אצל מטא, ואנחנו
 * מזינים לו ערכים בשם. `test/coordination-message.test.mjs` נועל את זה.
 */

/** המפתח במרשם `wa_templates`, נגזר משם התבנית ב-heyy. */
export const COORDINATION_TEMPLATE_KEY = 'rashal_visit_coordination';

/**
 * 🔴 **רשימה סגורה, ולא שדה חופשי.** הסדרן בוחר, ולכן הערך שמגיע למטא
 * הוא תמיד אחד מארבעה. ברגע שזה נפתח להקלדה, התבנית הופכת לדיוור.
 */
export const PURPOSES = [
  { value: 'לאספקת הציוד', label: 'אספקת ציוד' },
  { value: 'לאיסוף הציוד', label: 'איסוף ציוד' },
  { value: 'לביקור טכנאי', label: 'ביקור טכנאי' },
  { value: 'להתקנת הציוד', label: 'התקנה' },
] as const;

export type PurposeValue = (typeof PURPOSES)[number]['value'];

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * "2026-08-26" ⟵ "רביעי, 26.8.2026".
 *
 * 🔴 **בלי המילה "יום" בהתחלה, כי התבנית כבר אומרת אותה.** הגוף שאושר
 * הוא "ביום {{day}}", וערך שנפתח ב"יום" היה מייצר "ביום יום רביעי"
 * בהודעה שיוצאת ללקוח. נתפס בבדיקה ולא בעין. [[confirmation_text_built_in_code]]
 *
 * 🔴 **ועם השנה.** עידן, 25/08/2026: תאריך בלי שנה בהודעה שנשלחת ללקוח
 * שקיבל ציוד לפני שלוש שנים הוא תאריך שאי אפשר לקרוא.
 */
export function hebrewDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return String(iso ?? '');
  const [, y, mo, d] = m;
  const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(at.getTime())) return iso;
  return `${DAY_NAMES[at.getUTCDay()]}, ${Number(d)}.${Number(mo)}.${y}`;
}

/**
 * "09:00" + "13:00" ⟵ "09:00 עד 13:00".
 *
 * ⭐ משתנה אחד ולא שניים: כל משתנה נוסף הוא עוד חור אפשרי בטקסט, ומטא
 * גם חוסמת יחס פרמטרים גבוה מדי ביחס לאורך הגוף.
 */
export function hoursLabel(start: string, end: string): string {
  const s = String(start ?? '').trim();
  const e = String(end ?? '').trim();
  if (!s || !e) return s || e;
  return `${s} עד ${e}`;
}

export interface CoordinationInput {
  customerName: string;
  purpose: string;
  /** תאריך העצירה, YYYY-MM-DD. */
  date: string;
  timeStart: string;
  timeEnd: string;
}

/** הערכים לפי שם, בדיוק כפי שהתבנית ב-heyy מכירה אותם. */
export function coordinationValues(input: CoordinationInput): Record<string, string> {
  return {
    customer_name: String(input.customerName ?? '').trim() || 'לקוח יקר',
    purpose: String(input.purpose ?? '').trim(),
    day: hebrewDay(input.date),
    hours: hoursLabel(input.timeStart, input.timeEnd),
  };
}

/** מה שהלקוח יראה. תצוגה מקדימה בלבד, ראה את ההערה בראש הקובץ. */
export function coordinationPreview(input: CoordinationInput): string {
  const v = coordinationValues(input);
  return [
    `שלום ${v.customer_name}, כאן ר.שעל בע"מ.`,
    `אנחנו מעוניינים להגיע אליכם ${v.purpose} ביום ${v.day}, בין השעות ${v.hours}.`,
    'נשמח לדעת אם המועד מתאים לכם. אם לא, אפשר להשיב כאן מתי נוח לכם ונתאם מועד אחר.',
  ].join('\n');
}

/**
 * הכיתוב על שני כפתורי המענה המהיר בתבנית.
 *
 * 🔴🔴 **הכיתוב הוא ממשק ולא עיצוב.** לחיצה של הלקוח מגיעה אלינו כהודעה
 * נכנסת שהטקסט שלה הוא הכיתוב עצמו, ו-`parseCustomerReply` מפרש אותו.
 * מילה אחרת על הכפתור פירושה עצירה שנשארת "נשלח" לנצח, בלי שגיאה.
 * `test/coordination-message.test.mjs` מריץ את שניהם דרך המפרש האמיתי.
 */
export const COORDINATION_BUTTONS = ['מתאים לי', 'לא מתאים'] as const;

// ═══════════════════════════════════════════════════════════════════════
// שתי ההודעות שנוספו בשלב 8: מועד סגור, ותזכורת יום לפני
// ═══════════════════════════════════════════════════════════════════════
//
// ⭐ **אותם ארבעה משתנים בדיוק** (`customer_name` · `purpose` · `day` ·
// `hours`), ולכן `coordinationValues` משרת את שלושתן ואין שלושה בנאים
// שיתפצלו. מה שמשתנה הוא הגוף אצל מטא והאם יש כפתורים.
//
// 🔴 **וההבדל שקובע הכל: לשתי אלה אין שאלה ואין כפתורים.** תבנית
// התיאום שואלת "מתאים לכם?" ומחכה לתשובה שמעדכנת את היומן. אלה מודיעות.
// לכן אסור להשתמש בהן במקום התיאום: לקוח שיענה עליהן ייכנס לתיבה
// כשיחה פתוחה, ואף עצירה לא תתעדכן.

/** מודיעה על מועד שכבר נסגר. בלי שאלה, בלי כפתורים. */
export const CONFIRMED_TEMPLATE_KEY = 'rashal_visit_confirmed';

/** תזכורת ערב לפני. בלי שאלה, בלי כפתורים. */
export const REMINDER_TEMPLATE_KEY = 'rashal_visit_reminder';

/**
 * מה שהלקוח יראה כשהמועד סגור. תצוגה מקדימה בלבד: הגוף האמיתי שמור
 * אצל מטא, וכל שינוי בשורות האלה מחייב הגשה מחדש של התבנית.
 */
export function confirmedPreview(input: CoordinationInput): string {
  const v = coordinationValues(input);
  return [
    `שלום ${v.customer_name}, כאן ר.שעל בע"מ.`,
    `נגיע אליכם ${v.purpose} ביום ${v.day}, בין השעות ${v.hours}.`,
    'אם המועד אינו מתאים אפשר להשיב כאן ונתאם מחדש.',
  ].join('\n');
}

/**
 * התזכורת של הערב שלפני.
 *
 * ⭐ **"מחר" ואז התאריך המלא, ולא רק אחד מהם.** "מחר" לבדו נקרא שגוי
 * אם ההודעה נקראת בבוקר שאחרי, והתאריך לבדו מחייב את הלקוח לחשב.
 */
export function reminderPreview(input: CoordinationInput): string {
  const v = coordinationValues(input);
  return [
    `שלום ${v.customer_name}, כאן ר.שעל בע"מ.`,
    `תזכורת: מחר, יום ${v.day}, נגיע אליכם ${v.purpose} בין השעות ${v.hours}.`,
    'אם משהו השתנה אפשר להשיב כאן.',
  ].join('\n');
}
