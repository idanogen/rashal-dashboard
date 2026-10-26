/**
 * אישור קבלת הדרכה על מנוף חשמלי: הטופס שהלקוח חותם עליו כשמנוף מגיע אליו.
 *
 * ⭐⭐ גרסה 3 (עידן, 26/10/2026): הטופס הוא העתק של טופס הנייר של ר.שעל
 * (`~/Idan-HQ/meetings/rashal/2026-10-26-טופס-אישור-הדרכה-מנוף-מקור.pdf`),
 * "זה הטופס בכל פעם שמספקים מנוף חדש". סעיפים 1 עד 3 הם טקסט קבוע שהלקוח
 * מאשר בחתימה; הוא לא מסמן בהם כלום. עד גרסה 1 הטופס היה שמונה נושאי בטיחות
 * לסימון מתוך רשימת הבדיקה של הטכנאי.
 *
 * מה ממלאים (עידן):
 *   4. פרטי מקבל ההדרכה: שם ומשפחה, תעודת זהות, יחס קרבה לזכאי, חתימה. חובה.
 *   5. פרטי מבצע ההדרכה: השם של הנהג המחובר, לבד. "מספיק השם שלו", בלי חתימה.
 *   6. פרטי הערסל שסופק: יצרן, תאריך ייצור ומס"ד, או צילום (תווית הערסל).
 *      "או שממלאים את כל הפרטים של 6 או שמצרפים תמונה, אחד מהם תנאי" (עידן, 26/10).
 *
 * 🔴 הנוסח כאן הוא הצהרה משפטית שהלקוח חותם עליה. שינוי בו = גרסה חדשה
 * (`TRAINING_VERSION`), כדי שטופס ישן יישאר קריא כפי שנחתם.
 *
 * ⭐ קובץ בלי ייבוא: נבדק ב-node ומועתק לאפליקציה ב-`sync-forms.mjs`.
 */

export const TRAINING_TITLE = 'אישור קבלת הדרכה על מנוף חשמלי';

/**
 * גרסת הטופס. 🔴 נשמרת עם כל מילוי. 1 = נושאי בטיחות לסימון, 3 = טופס הנייר.
 * 🔴 אין 2 בכוונה: עד 26/10 הווב שמר על אישור הדרכה את גרסת רשימת הבדיקה (2),
 * ושתי שורות כאלה קיימות. 3 מבדיל בלי ספק את טופס הנייר מכל מה שלפניו.
 */
export const TRAINING_VERSION = 3;

export interface TrainingClause {
  /** האות או המספר כפי שמודפס בטופס: א, ב, 1. */
  mark: string;
  text: string;
  /** קטע בהדגשה בתוך הטקסט, כמו בטופס המקורי. */
  bold?: string;
  sub?: TrainingClause[];
}

export interface TrainingSection {
  no: number;
  title: string;
  clauses: TrainingClause[];
}

/** סעיפים 1 ו-2, מילה במילה מטופס הנייר. */
export const TRAINING_SECTIONS: TrainingSection[] = [
  {
    no: 1,
    title: 'ההדרכה כללה',
    clauses: [
      { mark: 'א', text: 'הסבר על אחריות המשתמש ובדיקות תקופתיות.' },
      { mark: 'ב', text: 'הסבר טכני על השימוש במנוף.' },
      { mark: 'ג', text: 'הסבר על הסיכונים הכרוכים וכללי זהירות בעת השימוש במנוף חשמלי.' },
      {
        mark: 'ד',
        text: 'הסבר על צורת הטעינה של המצבר ואף על חשיבות הטעינה לא יותר ממה שהומלץ.',
        bold: 'לא יותר ממה שהומלץ',
      },
      {
        mark: 'ה',
        text: 'ערסל',
        sub: [
          {
            mark: '1',
            text: 'חובת בדיקת תקינות ושלמות הערסל ורצועות ההנפה לפני כל הרמה, בהינתן ונמצאים פגמים ' +
              'חל איסור על המשך שימוש ופניה לקופת החולים / ר.שעל.',
            bold: 'חל איסור על המשך שימוש ופניה לקופת החולים / ר.שעל.',
          },
          { mark: '2', text: 'הסבר על תהליך הלבשת הערסל בעת ישיבה על כיסא גלגלים.' },
        ],
      },
      { mark: 'ו', text: 'הוסבר כיצד נכון להעביר הזכאי מכ"ג לכיסא / מכ"ג למיטה או ההיפך.' },
    ],
  },
  {
    no: 2,
    title: 'הצהרת מקבל המנוף',
    clauses: [
      { mark: 'א', text: 'הנני מצהיר בזאת שקיבלתי ההדרכה על המנוף החשמלי תוצרת "sunrise medical".' },
      { mark: 'ב', text: 'הנני מתחייב לשמור על כללי הבטיחות בעת השימוש, כפי שהוסבר לי.' },
      {
        mark: 'ג',
        text: 'הנני מבין שהשימוש במנוף חשמלי הוא אך ורק לנשיאת אדם ולא לצרכים אחרים.',
        bold: 'לנשיאת אדם',
      },
      { mark: 'ד', text: 'הנני מתחייב לא להיכנס עם המנוף אל חדר הרחצה.' },
      { mark: 'ה', text: 'הריני מאשר כי הבנתי את הדרכה וההנחיות שניתנו לי או לכל נציג מטעמי.' },
    ],
  },
];

/** סעיף 3: שורה אחת, בלי תתי סעיפים. */
export const TRAINING_SATISFACTION = 'ההדרכה בוצעה לשביעות רצוני באופן ברור ומובן.';

/** יחס קרבה לזכאי: רשימה, כי היא מהירה לנהג בשטח (עידן, 26/10/2026). */
export const TRAINING_RELATIONS = ['הזכאי עצמו', 'בן/בת', 'בן/בת זוג', 'מטפל/ת', 'אחר'] as const;

export interface TrainingInput {
  recipientName: string;
  recipientIdNumber: string;
  recipientRelation: string;
  signature: string | null;
  sling: { manufacturer: string; productionDate: string; serial: string };
  /** צילום של הערסל או של התווית שלו, data URL. מחליף את שלושת השדות. */
  slingPhoto?: string | null;
}

export interface TrainingGate {
  ok: boolean;
  /** מה חוסם, בעברית, מוכן להצגה. */
  reason?: string;
}

/**
 * 🔴 תעודת זהות: לפחות 5 תווים, ובלי בדיקת ספרת ביקורת. מקבל ההדרכה הוא
 * הרבה פעמים מטפל/ת זר/ה עם דרכון, ובדיקת ספרת ביקורת הייתה תוקעת את הנהג.
 */
export function idLooksValid(v: string): boolean {
  return v.replace(/[\s-]/g, '').length >= 5;
}

/** סעיף 6 מלא: שלושת השדות. */
export function slingComplete(sl: TrainingInput['sling']): boolean {
  return !!(sl.manufacturer.trim() && sl.productionDate.trim() && sl.serial.trim());
}

/**
 * האם מותר להחתים. ⭐ הודעה אחת בכל רגע, לפי סדר הטופס: קודם סעיף 4
 * (מה שהלקוח ממלא), אחר כך סעיף 6 (מה שהנהג ממלא), והחתימה אחרונה.
 */
export function canSubmitTraining(i: TrainingInput): TrainingGate {
  if (!i.recipientName.trim()) return { ok: false, reason: 'חסר שם ושם משפחה של מקבל ההדרכה' };
  if (!idLooksValid(i.recipientIdNumber)) return { ok: false, reason: 'חסרה תעודת זהות של מקבל ההדרכה' };
  if (!i.recipientRelation.trim()) return { ok: false, reason: 'חסר יחס קרבה לזכאי' };
  if (!slingComplete(i.sling) && !i.slingPhoto) {
    return { ok: false, reason: 'פרטי הערסל: למלא יצרן, תאריך ייצור ומס"ד, או לצרף צילום' };
  }
  if (!i.signature) return { ok: false, reason: 'חסרה חתימה של מקבל ההדרכה' };
  return { ok: true };
}

/**
 * מה נשמר בעמודת `answers` של `crane_forms`. אין סימונים בגרסה 3, ולכן
 * נשמר שהלקוח אישר את שלושת הסעיפים בחתימה.
 */
export const TRAINING_ANSWERS: Record<string, boolean> = { general: true, declaration: true, satisfaction: true };
